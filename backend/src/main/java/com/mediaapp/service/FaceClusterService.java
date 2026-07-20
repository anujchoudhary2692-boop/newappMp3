package com.mediaapp.service;

import com.mediaapp.dto.FaceClusterDto;
import com.mediaapp.dto.GalleryHitDto;
import com.mediaapp.dto.PersonDto;
import com.mediaapp.model.Capture;
import com.mediaapp.model.FaceCluster;
import com.mediaapp.model.FaceIndexEntry;
import com.mediaapp.model.Person;
import com.mediaapp.repository.FaceClusterRepository;
import com.mediaapp.repository.FaceIndexEntryRepository;
import com.mediaapp.repository.PersonRepository;
import lombok.extern.slf4j.Slf4j;
import org.opencv.core.Mat;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;

@Slf4j
@Service
public class FaceClusterService {

    private final FaceClusterRepository clusterRepository;
    private final FaceIndexEntryRepository indexRepository;
    private final PersonRepository personRepository;
    private final FaceAiEngine faceAiEngine;
    private final FaceRecognitionService faceRecognitionService;

    @Value("${app.storage.faces-dir:./storage/faces}")
    private String storageBase;

    private static final float CLUSTER_THRESHOLD = 0.55f;

    public FaceClusterService(
            FaceClusterRepository clusterRepository,
            FaceIndexEntryRepository indexRepository,
            PersonRepository personRepository,
            FaceAiEngine faceAiEngine,
            @Lazy FaceRecognitionService faceRecognitionService) {
        this.clusterRepository = clusterRepository;
        this.indexRepository = indexRepository;
        this.personRepository = personRepository;
        this.faceAiEngine = faceAiEngine;
        this.faceRecognitionService = faceRecognitionService;
    }

    public List<FaceClusterDto> listClusters() {
        return clusterRepository.findAllByOrderByUpdatedAtDesc().stream()
                .map(this::toDto)
                .toList();
    }

    public FaceClusterDto nameCluster(String clusterId, String name) throws IOException {
        FaceCluster cluster = clusterRepository.findById(clusterId)
                .orElseThrow(() -> new IllegalArgumentException("Cluster not found"));
        String trimmed = name == null ? "" : name.trim();
        if (trimmed.isEmpty()) {
            throw new IllegalArgumentException("Name is required");
        }
        cluster.setName(trimmed);
        cluster.setUpdatedAt(Instant.now());

        // Promote to registered Person if not linked
        if (cluster.getPersonId() == null && !cluster.getSampleImagePaths().isEmpty()) {
            Path sample = Path.of(cluster.getSampleImagePaths().get(0));
            if (Files.exists(sample)) {
                byte[] bytes = Files.readAllBytes(sample);
                MultipartFile mf = new ByteArrayMultipartFile("image.jpg", bytes);
                PersonDto person = faceRecognitionService.registerPerson(trimmed, "From People album", mf, "AUTO");
                cluster.setPersonId(person.getId());
                for (FaceIndexEntry entry : indexRepository.findByClusterId(clusterId)) {
                    entry.setPersonId(person.getId());
                    indexRepository.save(entry);
                }
            }
        }
        return toDto(clusterRepository.save(cluster));
    }

    public FaceClusterDto mergeCluster(String clusterId, String personId) {
        FaceCluster cluster = clusterRepository.findById(clusterId)
                .orElseThrow(() -> new IllegalArgumentException("Cluster not found"));
        Person person = personRepository.findById(personId)
                .orElseThrow(() -> new IllegalArgumentException("Person not found"));
        cluster.setPersonId(person.getId());
        cluster.setName(person.getName());
        cluster.setUpdatedAt(Instant.now());
        for (FaceIndexEntry entry : indexRepository.findByClusterId(clusterId)) {
            entry.setPersonId(person.getId());
            indexRepository.save(entry);
        }
        return toDto(clusterRepository.save(cluster));
    }

    /** Index all faces in a capture file into anonymous clusters. */
    public void indexCapture(Capture capture) {
        if (capture == null || capture.getFilePath() == null || !faceAiEngine.isReady()) {
            return;
        }
        Path path = Path.of(capture.getFilePath());
        if (!Files.exists(path)) {
            return;
        }
        try {
            List<FaceFeatureDetail> details = faceAiEngine.extractAllFeatureDetails(path, true);
            if (details.isEmpty()) {
                return;
            }
            // remove prior index for this capture
            for (FaceIndexEntry old : indexRepository.findBySourceIdAndSourceType(capture.getId(), "CAPTURE")) {
                indexRepository.delete(old);
            }
            for (FaceFeatureDetail detail : details) {
                try {
                    List<Float> embedding = matToList(detail.getFeature());
                    FaceCluster cluster = findOrCreateCluster(embedding, path.toString());
                    Path crop = saveCrop(path, detail, capture.getId());
                    FaceIndexEntry entry = FaceIndexEntry.builder()
                            .clusterId(cluster.getId())
                            .personId(cluster.getPersonId())
                            .sourceType("CAPTURE")
                            .sourceId(capture.getId())
                            .imagePath(path.toString())
                            .cropPath(crop != null ? crop.toString() : null)
                            .bboxX((int) detail.getBoxX())
                            .bboxY((int) detail.getBoxY())
                            .bboxW((int) detail.getBoxW())
                            .bboxH((int) detail.getBoxH())
                            .embedding(embedding)
                            .createdAt(Instant.now())
                            .build();
                    indexRepository.save(entry);
                    cluster.setFaceCount(cluster.getFaceCount() + 1);
                    cluster.setUpdatedAt(Instant.now());
                    clusterRepository.save(cluster);
                } finally {
                    detail.release();
                }
            }
        } catch (Exception e) {
            log.warn("Face index failed for capture {}: {}", capture.getId(), e.getMessage());
        }
    }

    /** Gallery-wide search: probe vs all indexed faces (+ registered people). */
    public List<GalleryHitDto> gallerySearch(MultipartFile image, int limit) throws IOException {
        if (image == null || image.isEmpty()) {
            throw new IllegalArgumentException("Image is required");
        }
        if (!faceAiEngine.isReady()) {
            throw new IllegalStateException("AI face engine not ready");
        }
        Path temp = Files.createTempFile("gallery_q_", ".jpg");
        Files.write(temp, image.getBytes());
        try {
            List<FaceFeatureDetail> details = faceAiEngine.extractAllFeatureDetails(temp, true);
            if (details.isEmpty()) {
                return List.of();
            }
            FaceFeatureDetail probe = details.get(0);
            List<GalleryHitDto> hits = new ArrayList<>();
            for (FaceIndexEntry entry : indexRepository.findAll()) {
                if (entry.getEmbedding() == null || entry.getEmbedding().isEmpty()) continue;
                float score = cosine(probe.getFeature(), entry.getEmbedding());
                if (score < CLUSTER_THRESHOLD) continue;
                String personName = null;
                if (entry.getPersonId() != null) {
                    personName = personRepository.findById(entry.getPersonId()).map(Person::getName).orElse(null);
                } else if (entry.getClusterId() != null) {
                    personName = clusterRepository.findById(entry.getClusterId()).map(FaceCluster::getName).orElse("Unknown face");
                }
                hits.add(GalleryHitDto.builder()
                        .indexId(entry.getId())
                        .clusterId(entry.getClusterId())
                        .personId(entry.getPersonId())
                        .personName(personName)
                        .sourceType(entry.getSourceType())
                        .sourceId(entry.getSourceId())
                        .imageUrl(toUrl(entry.getImagePath()))
                        .cropUrl(toUrl(entry.getCropPath() != null ? entry.getCropPath() : entry.getImagePath()))
                        .confidence(Math.round(score * 1000.0) / 10.0)
                        .bboxX(entry.getBboxX())
                        .bboxY(entry.getBboxY())
                        .bboxW(entry.getBboxW())
                        .bboxH(entry.getBboxH())
                        .build());
            }
            probe.release();
            for (int i = 1; i < details.size(); i++) details.get(i).release();
            hits.sort(Comparator.comparingDouble(GalleryHitDto::getConfidence).reversed());
            return hits.stream().limit(Math.max(1, limit)).toList();
        } finally {
            Files.deleteIfExists(temp);
        }
    }

    private FaceCluster findOrCreateCluster(List<Float> embedding, String samplePath) {
        FaceCluster best = null;
        float bestScore = -1f;
        for (FaceCluster c : clusterRepository.findAll()) {
            if (c.getCentroid() == null || c.getCentroid().isEmpty()) continue;
            float score = cosineList(embedding, c.getCentroid());
            if (score > bestScore) {
                bestScore = score;
                best = c;
            }
        }
        if (best != null && bestScore >= CLUSTER_THRESHOLD) {
            // update running centroid
            best.setCentroid(blend(best.getCentroid(), embedding, best.getFaceCount()));
            if (best.getSampleImagePaths().size() < 4) {
                best.getSampleImagePaths().add(samplePath);
            }
            return clusterRepository.save(best);
        }
        Instant now = Instant.now();
        FaceCluster created = FaceCluster.builder()
                .name(null)
                .centroid(new ArrayList<>(embedding))
                .sampleImagePaths(new ArrayList<>(List.of(samplePath)))
                .faceCount(0)
                .createdAt(now)
                .updatedAt(now)
                .build();
        return clusterRepository.save(created);
    }

    private Path saveCrop(Path source, FaceFeatureDetail detail, String captureId) {
        try {
            Path dir = Path.of(storageBase, "face_crops");
            Files.createDirectories(dir);
            // Store reference path; full crop extraction needs OpenCV imgops — keep source path as fallback
            Path marker = dir.resolve(captureId + "_" + detail.getFaceIndex() + ".ref");
            Files.writeString(marker, source + "|" + detail.getBoxX() + "," + detail.getBoxY()
                    + "," + detail.getBoxW() + "," + detail.getBoxH());
            return source;
        } catch (Exception e) {
            return source;
        }
    }

    private List<Float> matToList(Mat mat) {
        List<Float> list = new ArrayList<>();
        if (mat == null) return list;
        float[] data = new float[(int) (mat.total() * mat.channels())];
        mat.get(0, 0, data);
        for (float v : data) list.add(v);
        return list;
    }

    private float cosine(Mat query, List<Float> gallery) {
        float[] q = new float[(int) (query.total() * query.channels())];
        query.get(0, 0, q);
        if (q.length != gallery.size() || q.length == 0) return -1f;
        double dot = 0, nq = 0, ng = 0;
        for (int i = 0; i < q.length; i++) {
            float g = gallery.get(i);
            dot += q[i] * g;
            nq += q[i] * q[i];
            ng += g * g;
        }
        if (nq == 0 || ng == 0) return -1f;
        return (float) (dot / (Math.sqrt(nq) * Math.sqrt(ng)));
    }

    private float cosineList(List<Float> a, List<Float> b) {
        if (a.size() != b.size() || a.isEmpty()) return -1f;
        double dot = 0, na = 0, nb = 0;
        for (int i = 0; i < a.size(); i++) {
            float x = a.get(i), y = b.get(i);
            dot += x * y;
            na += x * x;
            nb += y * y;
        }
        if (na == 0 || nb == 0) return -1f;
        return (float) (dot / (Math.sqrt(na) * Math.sqrt(nb)));
    }

    private List<Float> blend(List<Float> centroid, List<Float> next, int count) {
        List<Float> out = new ArrayList<>(centroid.size());
        float w = Math.max(1, count);
        for (int i = 0; i < centroid.size(); i++) {
            out.add((centroid.get(i) * w + next.get(i)) / (w + 1));
        }
        return out;
    }

    private String toUrl(String path) {
        if (path == null) return null;
        if (path.startsWith("http")) return path;
        // Captures serve via /api/captures/{id}/file — keep relative path hint
        return path.contains("captures") ? null : "/files/" + Path.of(path).getFileName();
    }

    private FaceClusterDto toDto(FaceCluster c) {
        String sampleUrl = null;
        if (c.getSampleImagePaths() != null && !c.getSampleImagePaths().isEmpty()) {
            String p = c.getSampleImagePaths().get(0);
            // Prefer capture file URL if path contains capture id
            sampleUrl = toUrl(p);
        }
        return FaceClusterDto.builder()
                .id(c.getId())
                .name(c.getName() != null ? c.getName() : "Unnamed person")
                .personId(c.getPersonId())
                .faceCount(c.getFaceCount())
                .sampleImageUrl(sampleUrl)
                .createdAt(c.getCreatedAt() != null ? c.getCreatedAt().toString() : null)
                .updatedAt(c.getUpdatedAt() != null ? c.getUpdatedAt().toString() : null)
                .build();
    }

    /** Minimal MultipartFile for internal register calls. */
    private static final class ByteArrayMultipartFile implements MultipartFile {
        private final String name;
        private final byte[] bytes;

        ByteArrayMultipartFile(String name, byte[] bytes) {
            this.name = name;
            this.bytes = bytes;
        }

        @Override public String getName() { return "image"; }
        @Override public String getOriginalFilename() { return name; }
        @Override public String getContentType() { return "image/jpeg"; }
        @Override public boolean isEmpty() { return bytes.length == 0; }
        @Override public long getSize() { return bytes.length; }
        @Override public byte[] getBytes() { return bytes; }
        @Override public java.io.InputStream getInputStream() {
            return new java.io.ByteArrayInputStream(bytes);
        }
        @Override public void transferTo(java.io.File dest) throws IOException {
            Files.write(dest.toPath(), bytes);
        }
    }
}
