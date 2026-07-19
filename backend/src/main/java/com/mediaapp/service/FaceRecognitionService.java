package com.mediaapp.service;

import com.mediaapp.dto.FaceIdentifyResult;
import com.mediaapp.dto.FaceStatusDto;
import com.mediaapp.dto.LibraryScanResultDto;
import com.mediaapp.dto.MultiPersonScanResultDto;
import com.mediaapp.dto.PersonDto;
import com.mediaapp.dto.PersonMatchDto;
import com.mediaapp.dto.PersonPhotoDto;
import com.mediaapp.dto.PersonTimelineEntryDto;
import com.mediaapp.model.Person;
import com.mediaapp.model.PersonPhoto;
import com.mediaapp.model.FaceViewAngle;
import com.mediaapp.repository.PersonPhotoRepository;
import com.mediaapp.repository.PersonRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.opencv.core.Mat;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class FaceRecognitionService {

    private final PersonRepository personRepository;
    private final PersonPhotoRepository personPhotoRepository;
    private final Path facesPath;
    private final FaceAiEngine faceAiEngine;
    private final FaceAlertService faceAlertService;

    public FaceStatusDto getStatus() {
        long count = 0;
        try {
            count = personRepository.count();
        } catch (Exception e) {
            log.warn("Could not count persons: {}", e.getMessage());
        }
        boolean insightRequested = faceAiEngine.useInsightFace();
        boolean insightActive = "insightface".equalsIgnoreCase(faceAiEngine.getEngineType());
        String mode = insightActive ? "insightface" : (insightRequested ? "insightface-stub" : "opencv");
        return FaceStatusDto.builder()
                .engineReady(faceAiEngine.isReady())
                .registeredCount((int) count)
                .message(faceAiEngine.getStatusMessage()
                        + (insightRequested && !insightActive
                        ? " — rebuild Docker/Maven with -Pinsightface and ONNX models to enable InsightFace."
                        : ""))
                .engineType(faceAiEngine.getEngineType())
                .engineMode(mode)
                .insightFacePackaged(insightActive)
                .build();
    }

    public PersonDto registerPerson(String name, String notes, MultipartFile image, String viewHint)
            throws IOException {
        if (name == null || name.isBlank()) {
            throw new IllegalArgumentException("Name is required");
        }
        if (image == null || image.isEmpty()) {
            throw new IllegalArgumentException("Image is required");
        }
        if (!faceAiEngine.isReady()) {
            throw new IllegalStateException("AI face engine not ready. Restart backend and check internet for model download.");
        }

        Files.createDirectories(facesPath);
        String fileName = UUID.randomUUID() + "_" + sanitize(name) + getExtension(image.getOriginalFilename());
        Path saved = facesPath.resolve(fileName);
        Files.write(saved, image.getBytes());

        if (!canReadImage(saved)) {
            Files.deleteIfExists(saved);
            throw new IllegalArgumentException(
                    "Could not read photo. Use JPEG/PNG or pick again from gallery.");
        }

        FaceViewAngle hint = FaceViewAngle.fromHint(viewHint);
        RegistrationFeature registration = faceAiEngine.extractRegistrationFeature(saved, hint);
        if (registration == null || registration.getFeature() == null || registration.getFeature().empty()) {
            Files.deleteIfExists(saved);
            throw new IllegalArgumentException(
                    "No face detected. Try front, side, or partial face — ensure face is visible.");
        }

        Person person = personRepository.findByNameIgnoreCase(name.trim())
                .orElse(Person.builder()
                        .name(name.trim())
                        .notes(notes)
                        .embeddingEngine(faceAiEngine.getEngineType())
                        .createdAt(Instant.now())
                        .imagePaths(new ArrayList<>())
                        .faceEmbeddings(new ArrayList<>())
                        .faceViewAngles(new ArrayList<>())
                        .build());

        if (person.getEmbeddingEngine() == null || person.getEmbeddingEngine().isBlank()) {
            person.setEmbeddingEngine(faceAiEngine.getEngineType());
        }

        if (person.getImagePaths() == null) {
            person.setImagePaths(new ArrayList<>());
        }
        if (person.getFaceEmbeddings() == null) {
            person.setFaceEmbeddings(new ArrayList<>());
        }
        if (person.getFaceViewAngles() == null) {
            person.setFaceViewAngles(new ArrayList<>());
        }

        person.getImagePaths().add(saved.toString());
        person.getFaceEmbeddings().add(faceAiEngine.featureToList(registration.getFeature()));
        person.getFaceViewAngles().add(registration.getDetectedAngle().name());
        registration.getFeature().release();

        person.setNotes(notes);
        person.setUpdatedAt(Instant.now());
        if (person.getCreatedAt() == null) {
            person.setCreatedAt(Instant.now());
        }

        Person savedPerson = personRepository.save(person);
        return toDto(savedPerson, registration.getDetectedAngle().name());
    }

    public List<PersonDto> listPersons() {
        return personRepository.findAll().stream()
                .sorted(Comparator.comparing(Person::getCreatedAt, Comparator.nullsLast(Comparator.reverseOrder())))
                .map(p -> toDto(p, null))
                .toList();
    }

    public PersonDto updatePerson(String id, String name, String notes) {
        Person person = personRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Person not found"));
        if (name != null && !name.isBlank()) {
            person.setName(name.trim());
        }
        if (notes != null) {
            person.setNotes(notes.trim().isEmpty() ? null : notes.trim());
        }
        person.setUpdatedAt(Instant.now());
        return toDto(personRepository.save(person), null);
    }

    public FaceIdentifyResult identify(MultipartFile image) throws IOException {
        if (image == null || image.isEmpty()) {
            throw new IllegalArgumentException("Image is required");
        }
        if (!faceAiEngine.isReady()) {
            throw new IllegalStateException("AI face engine not ready. Restart the backend.");
        }

        List<Person> persons = personRepository.findAll();
        if (persons.isEmpty()) {
            throw new IllegalArgumentException("No registered faces. Add people first.");
        }

        Path tempQuery = Files.createTempFile("query_", getExtension(image.getOriginalFilename()));
        Files.write(tempQuery, image.getBytes());

        try {
            List<Mat> queryFeatures = faceAiEngine.extractAllFeatures(tempQuery, true);
            if (queryFeatures.isEmpty()) {
                return FaceIdentifyResult.builder()
                        .matched(false)
                        .confidence(0)
                        .facesScanned(0)
                        .matchGap(0)
                        .build();
            }

            for (Person person : persons) {
                ensureEmbeddings(person);
            }

            FaceMatchHelper.MatchOutcome bestOutcome = null;
            for (Mat queryFeature : queryFeatures) {
                FaceMatchHelper.MatchOutcome outcome = FaceMatchHelper.matchAgainstAll(
                        queryFeature,
                        persons,
                        faceAiEngine,
                        faceAiEngine.getMatchThreshold(),
                        faceAiEngine.getMinMatchGap());
                if (bestOutcome == null || outcome.getBestScore() > bestOutcome.getBestScore()) {
                    bestOutcome = outcome;
                }
                queryFeature.release();
            }

            if (bestOutcome == null) {
                return FaceIdentifyResult.builder()
                        .matched(false)
                        .confidence(0)
                        .facesScanned(queryFeatures.size())
                        .matchGap(0)
                        .build();
            }

            double gap = bestOutcome.getSecondBestScore() < 0
                    ? 100
                    : FaceMatchHelper.toPercent(bestOutcome.getBestScore() - bestOutcome.getSecondBestScore());

            return FaceIdentifyResult.builder()
                    .matched(bestOutcome.isMatched())
                    .personId(bestOutcome.isMatched() ? bestOutcome.getBestPerson().getId() : null)
                    .personName(bestOutcome.isMatched() ? bestOutcome.getBestPerson().getName() : null)
                    .confidence(FaceMatchHelper.toPercent(bestOutcome.getBestScore()))
                    .facesScanned(queryFeatures.size())
                    .matchGap(gap)
                    .candidates(bestOutcome.getCandidates())
                    .build();
        } finally {
            Files.deleteIfExists(tempQuery);
        }
    }

    public void deletePerson(String id) throws IOException {
        Person person = personRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Person not found"));
        if (person.getImagePaths() != null) {
            for (String path : person.getImagePaths()) {
                Files.deleteIfExists(Path.of(path));
            }
        }
        List<PersonPhoto> photos = personPhotoRepository.findByPersonIdOrderByMatchedAtDesc(id);
        for (PersonPhoto photo : photos) {
            Files.deleteIfExists(Path.of(photo.getFilePath()));
        }
        personPhotoRepository.deleteByPersonId(id);
        Files.deleteIfExists(facesPath.resolve("gallery").resolve(id));
        personRepository.delete(person);
    }

    public List<PersonPhotoDto> listPersonPhotos(String personId) {
        personRepository.findById(personId)
                .orElseThrow(() -> new IllegalArgumentException("Person not found"));
        return personPhotoRepository.findByPersonIdOrderByMatchedAtDesc(personId).stream()
                .map(this::toPhotoDto)
                .toList();
    }

    public LibraryScanResultDto scanLibraryPhoto(
            String personId,
            MultipartFile image,
            String devicePhotoId,
            String sourceType,
            Long sourceTimestampMs,
            Double latitude,
            Double longitude,
            String address,
            String city,
            String country) throws IOException {
        Person person = personRepository.findById(personId)
                .orElseThrow(() -> new IllegalArgumentException("Person not found"));
        if (image == null || image.isEmpty()) {
            throw new IllegalArgumentException("Image is required");
        }
        if (!faceAiEngine.isReady()) {
            throw new IllegalStateException("AI face engine not ready");
        }

        if (devicePhotoId != null && !devicePhotoId.isBlank()) {
            var existing = personPhotoRepository.findByPersonIdAndDevicePhotoId(personId, devicePhotoId);
            if (existing.isPresent()) {
                return LibraryScanResultDto.builder()
                        .devicePhotoId(devicePhotoId)
                        .matched(true)
                        .saved(false)
                        .confidence(existing.get().getConfidence())
                        .photoId(existing.get().getId())
                        .build();
            }
        }

        Path temp = Files.createTempFile("scan_", getExtension(image.getOriginalFilename()));
        Files.write(temp, image.getBytes());

        try {
            List<FaceFeatureDetail> faceDetails = faceAiEngine.extractAllFeatureDetails(temp, true);
            if (faceDetails.isEmpty()) {
                return LibraryScanResultDto.builder()
                        .devicePhotoId(devicePhotoId)
                        .matched(false)
                        .saved(false)
                        .confidence(0)
                        .sourceType(sourceType)
                        .sourceTimestampMs(sourceTimestampMs)
                        .build();
            }

            ensureEmbeddings(person);
            float personBest = -1f;
            FaceFeatureDetail bestDetail = null;
            for (FaceFeatureDetail detail : faceDetails) {
                float score = FaceMatchHelper.scorePerson(detail.getFeature(), person, faceAiEngine);
                if (score > personBest) {
                    personBest = score;
                    bestDetail = detail;
                }
            }
            for (FaceFeatureDetail detail : faceDetails) {
                detail.release();
            }

            int totalFaces = bestDetail != null ? bestDetail.getTotalFaces() : faceDetails.size();
            boolean groupPhoto = totalFaces > 1;
            int matchedFaceIndex = bestDetail != null ? bestDetail.getFaceIndex() : 0;

            float threshold = faceAiEngine.getMatchThreshold();
            boolean matched = personBest >= threshold;

            if (!matched) {
                return LibraryScanResultDto.builder()
                        .devicePhotoId(devicePhotoId)
                        .matched(false)
                        .saved(false)
                        .confidence(Math.round(personBest * 1000.0) / 10.0)
                        .facesDetected(totalFaces)
                        .groupPhoto(groupPhoto)
                        .sourceType(sourceType)
                        .sourceTimestampMs(sourceTimestampMs)
                        .build();
            }

            PersonPhoto record = saveGalleryMatch(
                    person,
                    temp,
                    devicePhotoId,
                    sourceType,
                    sourceTimestampMs,
                    totalFaces,
                    groupPhoto,
                    matchedFaceIndex,
                    buildLibraryMatchContext(latitude, longitude, address, city, country));

            return LibraryScanResultDto.builder()
                    .devicePhotoId(devicePhotoId)
                    .matched(true)
                    .saved(true)
                    .confidence(record.getConfidence())
                    .photoId(record.getId())
                    .facesDetected(totalFaces)
                    .groupPhoto(groupPhoto)
                    .matchedFaceIndex(matchedFaceIndex)
                    .sourceType(record.getSourceType())
                    .sourceTimestampMs(sourceTimestampMs)
                    .build();
        } finally {
            Files.deleteIfExists(temp);
        }
    }

    public MultiPersonScanResultDto scanImageAgainstAll(MultipartFile image, boolean saveMatches) throws IOException {
        if (image == null || image.isEmpty()) {
            throw new IllegalArgumentException("Image is required");
        }
        Path temp = Files.createTempFile("scan_all_", getExtension(image.getOriginalFilename()));
        Files.write(temp, image.getBytes());
        try {
            return scanImagePathForAllPersons(temp, FaceMatchContext.builder()
                    .devicePhotoId("scan:" + UUID.randomUUID())
                    .sourceType("SCAN")
                    .build(), saveMatches);
        } finally {
            Files.deleteIfExists(temp);
        }
    }

    public MultiPersonScanResultDto scanImagePathForAllPersons(
            Path imagePath,
            FaceMatchContext ctx,
            boolean saveMatches) {
        requireEngineReady();
        List<Person> persons = personRepository.findAll();
        if (persons.isEmpty()) {
            return MultiPersonScanResultDto.builder().facesDetected(0).build();
        }
        for (Person person : persons) {
            ensureEmbeddings(person);
        }

        List<FaceFeatureDetail> faceDetails = faceAiEngine.extractAllFeatureDetails(imagePath, true);
        if (faceDetails.isEmpty()) {
            return MultiPersonScanResultDto.builder().facesDetected(0).build();
        }

        float threshold = faceAiEngine.getMatchThreshold();
        List<PersonMatchDto> matches = new ArrayList<>();
        Set<String> savedKeys = new HashSet<>();

        for (FaceFeatureDetail detail : faceDetails) {
            FaceMatchHelper.MatchOutcome outcome = FaceMatchHelper.matchAgainstAll(
                    detail.getFeature(),
                    persons,
                    faceAiEngine,
                    threshold,
                    faceAiEngine.getMinMatchGap());

            if (outcome.isMatched() && outcome.getBestPerson() != null) {
                Person person = outcome.getBestPerson();
                String dedupeKey = person.getId() + ":" + ctx.getDevicePhotoId();
                boolean alreadySaved = ctx.getDevicePhotoId() != null
                        && personPhotoRepository.findByPersonIdAndDevicePhotoId(person.getId(), ctx.getDevicePhotoId()).isPresent();
                boolean saved = false;
                String photoId = null;

                if (saveMatches && !alreadySaved && !savedKeys.contains(dedupeKey)) {
                    try {
                        PersonPhoto record = saveGalleryMatch(
                                person,
                                imagePath,
                                ctx.getDevicePhotoId(),
                                ctx.getSourceType() != null ? ctx.getSourceType() : "SCAN",
                                ctx.getSourceTimestampMs(),
                                detail.getTotalFaces(),
                                detail.getTotalFaces() > 1,
                                detail.getFaceIndex(),
                                ctx);
                        saved = true;
                        photoId = record.getId();
                        savedKeys.add(dedupeKey);
                    } catch (IOException e) {
                        log.warn("Could not save gallery match: {}", e.getMessage());
                    }
                } else if (alreadySaved) {
                    photoId = personPhotoRepository.findByPersonIdAndDevicePhotoId(person.getId(), ctx.getDevicePhotoId())
                            .map(PersonPhoto::getId)
                            .orElse(null);
                }

                matches.add(PersonMatchDto.builder()
                        .personId(person.getId())
                        .personName(person.getName())
                        .confidence(FaceMatchHelper.toPercent(outcome.getBestScore()))
                        .matched(true)
                        .saved(saved || alreadySaved)
                        .photoId(photoId)
                        .faceIndex(detail.getFaceIndex())
                        .build());
            }
            detail.release();
        }

        return MultiPersonScanResultDto.builder()
                .facesDetected(faceDetails.size())
                .matches(matches)
                .build();
    }

    public PersonTimelineEntryDto toTimelineEntry(PersonPhoto photo) {
        PersonTimelineEntryDto entry = PersonTimelineEntryDto.builder()
                .id(photo.getId())
                .personId(photo.getPersonId())
                .imageUrl(buildImageUrl(photo.getFileName()))
                .confidence(photo.getConfidence())
                .matchedAt(photo.getMatchedAt() != null ? photo.getMatchedAt().toString() : null)
                .sourceType(photo.getSourceType())
                .sourceTimestampMs(photo.getSourceTimestampMs())
                .devicePhotoId(photo.getDevicePhotoId())
                .captureId(photo.getCaptureId())
                .mediaVideoId(photo.getMediaVideoId())
                .mediaTitle(photo.getMediaTitle())
                .latitude(photo.getLatitude())
                .longitude(photo.getLongitude())
                .locationLabel(photo.getLocationLabel())
                .groupPhoto(photo.getGroupPhoto())
                .facesDetected(photo.getFacesDetected())
                .build();

        if (photo.getMediaVideoId() != null && photo.getSourceTimestampMs() != null) {
            entry.setPlaybackUrl("/player?media=" + photo.getMediaVideoId() + "&t=" + photo.getSourceTimestampMs());
        } else if (photo.getCaptureId() != null) {
            entry.setPlaybackUrl("/camera?capture=" + photo.getCaptureId());
        }
        return entry;
    }

    private PersonPhoto saveGalleryMatch(
            Person person,
            Path sourceImage,
            String devicePhotoId,
            String sourceType,
            Long sourceTimestampMs,
            int totalFaces,
            boolean groupPhoto,
            int matchedFaceIndex,
            FaceMatchContext ctx) throws IOException {
        float score = -1f;
        List<FaceFeatureDetail> details = faceAiEngine.extractAllFeatureDetails(sourceImage, true);
        for (FaceFeatureDetail detail : details) {
            float s = FaceMatchHelper.scorePerson(detail.getFeature(), person, faceAiEngine);
            if (s > score) {
                score = s;
            }
            detail.release();
        }

        Path galleryDir = facesPath.resolve("gallery").resolve(person.getId());
        Files.createDirectories(galleryDir);
        String fileName = UUID.randomUUID() + getExtension(sourceImage.getFileName().toString());
        Path saved = galleryDir.resolve(fileName);
        Files.copy(sourceImage, saved, java.nio.file.StandardCopyOption.REPLACE_EXISTING);

        PersonPhoto.PersonPhotoBuilder builder = PersonPhoto.builder()
                .personId(person.getId())
                .fileName("gallery/" + person.getId() + "/" + fileName)
                .filePath(saved.toString())
                .confidence(Math.round(score * 1000.0) / 10.0)
                .devicePhotoId(devicePhotoId)
                .matchedAt(Instant.now())
                .sourceType(sourceType != null ? sourceType : "PHOTO")
                .sourceTimestampMs(sourceTimestampMs)
                .facesDetected(totalFaces)
                .groupPhoto(groupPhoto)
                .matchedFaceIndex(matchedFaceIndex);

        if (ctx != null) {
            builder.captureId(ctx.getCaptureId())
                    .mediaVideoId(ctx.getMediaVideoId())
                    .mediaTitle(ctx.getMediaTitle())
                    .latitude(ctx.getLatitude())
                    .longitude(ctx.getLongitude())
                    .locationLabel(ctx.getLocationLabel());
        }

        PersonPhoto photo = personPhotoRepository.save(builder.build());
        faceAlertService.recordMatch(person, photo);
        return photo;
    }

    private void requireEngineReady() {
        if (!faceAiEngine.isReady()) {
            throw new IllegalStateException("AI face engine not ready");
        }
    }

    private FaceMatchContext buildLibraryMatchContext(
            Double latitude,
            Double longitude,
            String address,
            String city,
            String country) {
        if (latitude == null || longitude == null) {
            return null;
        }
        String locationLabel = null;
        if (city != null && country != null) {
            locationLabel = city + ", " + country;
        } else if (address != null && !address.isBlank()) {
            locationLabel = address;
        } else {
            locationLabel = String.format("%.4f, %.4f", latitude, longitude);
        }
        return FaceMatchContext.builder()
                .latitude(latitude)
                .longitude(longitude)
                .locationLabel(locationLabel)
                .build();
    }

    private String buildImageUrl(String fileName) {
        return "/api/faces/image?path=" + java.net.URLEncoder.encode(
                fileName, java.nio.charset.StandardCharsets.UTF_8);
    }

    public void deletePersonPhoto(String photoId) throws IOException {
        PersonPhoto photo = personPhotoRepository.findById(photoId)
                .orElseThrow(() -> new IllegalArgumentException("Photo not found"));
        Files.deleteIfExists(Path.of(photo.getFilePath()));
        personPhotoRepository.delete(photo);
    }

    private boolean canReadImage(Path path) {
        Mat image = faceAiEngine.readImage(path);
        boolean ok = !image.empty();
        image.release();
        return ok;
    }

    private PersonPhotoDto toPhotoDto(PersonPhoto photo) {
        return PersonPhotoDto.builder()
                .id(photo.getId())
                .personId(photo.getPersonId())
                .imageUrl(buildImageUrl(photo.getFileName()))
                .confidence(photo.getConfidence())
                .matchedAt(photo.getMatchedAt() != null ? photo.getMatchedAt().toString() : null)
                .devicePhotoId(photo.getDevicePhotoId())
                .sourceType(photo.getSourceType())
                .sourceTimestampMs(photo.getSourceTimestampMs())
                .facesDetected(photo.getFacesDetected())
                .groupPhoto(photo.getGroupPhoto())
                .matchedFaceIndex(photo.getMatchedFaceIndex())
                .captureId(photo.getCaptureId())
                .mediaVideoId(photo.getMediaVideoId())
                .mediaTitle(photo.getMediaTitle())
                .latitude(photo.getLatitude())
                .longitude(photo.getLongitude())
                .locationLabel(photo.getLocationLabel())
                .build();
    }

    /** Rebuild AI embeddings from saved photos (for older registrations). */
    private void ensureEmbeddings(Person person) {
        if (person.getImagePaths() == null || person.getImagePaths().isEmpty()) {
            return;
        }
        if (person.getFaceEmbeddings() != null
                && person.getFaceEmbeddings().size() == person.getImagePaths().size()
                && person.getFaceViewAngles() != null
                && person.getFaceViewAngles().size() == person.getImagePaths().size()) {
            return;
        }
        List<List<Float>> rebuilt = new ArrayList<>();
        List<String> rebuiltAngles = new ArrayList<>();
        for (String imagePath : person.getImagePaths()) {
            Path path = Path.of(imagePath);
            if (!Files.exists(path)) {
                continue;
            }
            RegistrationFeature reg = faceAiEngine.extractRegistrationFeature(path, FaceViewAngle.UNKNOWN);
            if (reg != null && reg.getFeature() != null && !reg.getFeature().empty()) {
                rebuilt.add(faceAiEngine.featureToList(reg.getFeature()));
                rebuiltAngles.add(reg.getDetectedAngle().name());
                reg.getFeature().release();
            }
        }
        if (!rebuilt.isEmpty()) {
            person.setFaceEmbeddings(rebuilt);
            person.setFaceViewAngles(rebuiltAngles);
            personRepository.save(person);
        }
    }

    private PersonDto toDto(Person person, String lastRegisteredView) {
        String imageUrl = null;
        if (person.getImagePaths() != null && !person.getImagePaths().isEmpty()) {
            Path p = Path.of(person.getImagePaths().get(person.getImagePaths().size() - 1));
            imageUrl = "/api/faces/image?path=" + java.net.URLEncoder.encode(
                    p.getFileName().toString(), java.nio.charset.StandardCharsets.UTF_8);
        }
        List<String> views = person.getFaceViewAngles() != null
                ? person.getFaceViewAngles()
                : List.of();
        return PersonDto.builder()
                .id(person.getId())
                .name(person.getName())
                .notes(person.getNotes())
                .imageUrl(imageUrl)
                .createdAt(person.getCreatedAt() != null ? person.getCreatedAt().toString() : null)
                .photoCount(personPhotoRepository.countByPersonId(person.getId()))
                .lastRegisteredView(lastRegisteredView)
                .registeredViews(new ArrayList<>(views))
                .build();
    }

    public byte[] getFaceImage(String fileName) throws IOException {
        Path file = facesPath.resolve(fileName).normalize();
        if (!file.startsWith(facesPath) || !Files.exists(file)) {
            throw new IllegalArgumentException("Image not found");
        }
        return Files.readAllBytes(file);
    }

    private String sanitize(String input) {
        return input.replaceAll("[^a-zA-Z0-9._-]", "_");
    }

    private String getExtension(String name) {
        if (name == null || !name.contains(".")) {
            return ".jpg";
        }
        return name.substring(name.lastIndexOf('.'));
    }
}
