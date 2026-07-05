package com.mediaapp.service;

import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import nu.pattern.OpenCV;
import org.opencv.core.CvType;
import org.opencv.core.Mat;
import org.opencv.core.Size;
import org.opencv.imgcodecs.Imgcodecs;
import org.opencv.objdetect.FaceDetectorYN;
import org.opencv.objdetect.FaceRecognizerSF;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.util.List;

import com.mediaapp.model.FaceViewAngle;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.IOException;
import java.io.InputStream;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

@Slf4j
@Component
public class FaceAiEngine {

    private static final String YUNET_URL =
            "https://github.com/opencv/opencv_zoo/raw/main/models/face_detection_yunet/face_detection_yunet_2023mar.onnx";
    private static final String SFACE_URL =
            "https://github.com/opencv/opencv_zoo/raw/main/models/face_recognition_sface/face_recognition_sface_2021dec.onnx";
    private static final int MAX_FACES_PER_IMAGE = 20;

    private final Path modelsDir;

    @Value("${app.face.match-threshold:0.34}")
    private float matchThreshold;

    @Value("${app.face.min-match-gap:0.025}")
    private float minMatchGap;

    @Value("${app.face.det-score-threshold:0.55}")
    private float detScoreThreshold;

    @Value("${app.face.det-score-sensitive:0.32}")
    private float detScoreSensitive;

    @Value("${app.face.min-face-size-register:64}")
    private int minFaceSizeRegister;

    @Value("${app.face.min-face-size-identify:36}")
    private int minFaceSizeIdentify;

    @Value("${app.face.min-face-size-side:48}")
    private int minFaceSizeSide;

    @Value("${app.features.face-ai:true}")
    private boolean faceAiEnabled;

    @Value("${app.face.engine:opencv}")
    private String engineType;

    @Autowired(required = false)
    private List<OptionalFaceEngine> optionalEngines;

    private FaceDetectorYN standardDetector;
    private FaceDetectorYN sensitiveDetector;
    private FaceRecognizerSF recognizer;
    private boolean ready;
    private String statusMessage = "Initializing AI face engine...";

    public FaceAiEngine(@Value("${app.face.models-dir:./storage/models}") String modelsDir) {
        this.modelsDir = Path.of(modelsDir).toAbsolutePath().normalize();
    }

    @PostConstruct
    public void init() {
        if (!faceAiEnabled) {
            ready = false;
            statusMessage = "Face AI disabled on this server";
            log.info("Face AI engine skipped (app.features.face-ai=false)");
            return;
        }
        try {
            OpenCV.loadLocally();
            Files.createDirectories(modelsDir);

            Path yunet = modelsDir.resolve("face_detection_yunet_2023mar.onnx");
            Path sface = modelsDir.resolve("face_recognition_sface_2021dec.onnx");

            ensureModel(YUNET_URL, yunet);
            ensureModel(SFACE_URL, sface);

            standardDetector = FaceDetectorYN.create(
                    yunet.toString(), "",
                    new Size(320, 320),
                    detScoreThreshold, 0.3f, 5000);
            sensitiveDetector = FaceDetectorYN.create(
                    yunet.toString(), "",
                    new Size(320, 320),
                    detScoreSensitive, 0.35f, 5000);
            recognizer = FaceRecognizerSF.create(sface.toString(), "");

            ready = standardDetector != null && sensitiveDetector != null && recognizer != null;
            if (useInsightFace() && activeOptionalEngine() != null) {
                statusMessage = "InsightFace ONNX ready — high-accuracy 512-d embeddings";
            } else {
                statusMessage = ready
                        ? "AI ready — front, side & partial face views (OpenCV SFace)"
                        : "AI models failed to load";
            }
            log.info("Face AI engine ready: {} (engine={})", ready, getEngineType());
        } catch (Exception e) {
            ready = false;
            statusMessage = "AI face engine failed: " + e.getMessage();
            log.error("Face AI init failed", e);
        }
    }

    public boolean isReady() {
        return ready;
    }

    public String getStatusMessage() {
        return statusMessage;
    }

    public String getEngineType() {
        if (useInsightFace() && activeOptionalEngine() != null) {
            return "insightface";
        }
        return "opencv";
    }

    public boolean useInsightFace() {
        return "insightface".equalsIgnoreCase(engineType);
    }

    public float getMatchThreshold() {
        OptionalFaceEngine engine = activeOptionalEngine();
        if (useInsightFace() && engine != null) {
            return engine.getMatchThreshold();
        }
        return matchThreshold;
    }

    public float getMinMatchGap() {
        return minMatchGap;
    }

    public boolean hasFace(Path imagePath) {
        return !extractAllFeatures(imagePath, true).isEmpty();
    }

    public Mat readImage(Path imagePath) {
        Mat image = Imgcodecs.imread(imagePath.toString());
        if (!image.empty()) {
            return image;
        }
        image.release();

        try {
            BufferedImage buffered = ImageIO.read(imagePath.toFile());
            if (buffered == null) {
                log.warn("Could not decode image: {}", imagePath.getFileName());
                return new Mat();
            }
            BufferedImage bgr = new BufferedImage(
                    buffered.getWidth(), buffered.getHeight(), BufferedImage.TYPE_3BYTE_BGR);
            bgr.getGraphics().drawImage(buffered, 0, 0, null);
            byte[] pixels = ((java.awt.image.DataBufferByte) bgr.getRaster().getDataBuffer()).getData();
            Mat mat = new Mat(bgr.getHeight(), bgr.getWidth(), CvType.CV_8UC3);
            mat.put(0, 0, pixels);
            return mat;
        } catch (IOException e) {
            log.warn("ImageIO read failed for {}: {}", imagePath.getFileName(), e.getMessage());
            return new Mat();
        }
    }

    public boolean isFaceQualityOk(Path imagePath) {
        Mat image = readImage(imagePath);
        if (image.empty()) {
            image.release();
            return false;
        }
        try {
            List<DetectedFace> faces = detectAllFaces(image, false, minFaceSizeRegister);
            return !faces.isEmpty();
        } finally {
            image.release();
        }
    }

    public Mat extractFeature(Path imagePath) {
        List<Mat> features = extractAllFeatures(imagePath, false);
        return features.isEmpty() ? null : features.get(0);
    }

    /**
     * Register a face from any visible angle — uses sensitive AI detection
     * and auto-classifies front / left / right / partial view.
     */
    public RegistrationFeature extractRegistrationFeature(Path imagePath, FaceViewAngle viewHint) {
        Mat image = readImage(imagePath);
        if (image.empty()) {
            image.release();
            return null;
        }

        try {
            List<DetectedFace> faces = detectAllFaces(image, true, minFaceSizeSide);
            if (faces.isEmpty()) {
                return null;
            }

            DetectedFace best = faces.get(0);
            for (int i = 1; i < faces.size(); i++) {
                faces.get(i).faceRow().release();
            }

            FaceViewAngle detected = classifyFaceAngle(best.faceRow());
            FaceViewAngle finalAngle = viewHint != null && viewHint != FaceViewAngle.UNKNOWN
                    ? viewHint
                    : (detected != FaceViewAngle.UNKNOWN ? detected : FaceViewAngle.PARTIAL);

            Mat feature = featureFromFace(image, best.faceRow());
            best.faceRow().release();

            if (feature == null || feature.empty()) {
                return null;
            }

            return RegistrationFeature.builder()
                    .feature(feature)
                    .detectedAngle(finalAngle)
                    .detectionScore(best.score())
                    .build();
        } finally {
            image.release();
        }
    }

    /** Classify viewing angle from YuNet facial landmarks. */
    public FaceViewAngle classifyFaceAngle(Mat faceRow) {
        if (faceRow == null || faceRow.empty() || faceRow.cols() < 15) {
            return FaceViewAngle.UNKNOWN;
        }

        double w = faceRow.get(0, 2)[0];
        double h = faceRow.get(0, 3)[0];
        if (w <= 0 || h <= 0) {
            return FaceViewAngle.UNKNOWN;
        }

        double xRe = faceRow.get(0, 4)[0];
        double yRe = faceRow.get(0, 5)[0];
        double xLe = faceRow.get(0, 6)[0];
        double yLe = faceRow.get(0, 7)[0];
        double xNt = faceRow.get(0, 8)[0];
        double yNt = faceRow.get(0, 9)[0];

        double eyeDist = Math.hypot(xLe - xRe, yLe - yRe);
        double faceDiag = Math.hypot(w, h);

        if (eyeDist < faceDiag * 0.12) {
            return FaceViewAngle.PARTIAL;
        }

        double eyeMidX = (xRe + xLe) * 0.5;
        double noseOffset = (xNt - eyeMidX) / Math.max(eyeDist, 1.0);

        if (Math.abs(noseOffset) < 0.10) {
            return FaceViewAngle.FRONT;
        }
        if (noseOffset > 0.12) {
            return FaceViewAngle.RIGHT;
        }
        if (noseOffset < -0.12) {
            return FaceViewAngle.LEFT;
        }
        return FaceViewAngle.PARTIAL;
    }

    /** Extract embeddings from every face found (standard + sensitive pass for partial faces). */
    public List<Mat> extractAllFeatures(Path imagePath, boolean sensitive) {
        List<FaceFeatureDetail> details = extractAllFeatureDetails(imagePath, sensitive);
        List<Mat> features = new ArrayList<>();
        for (FaceFeatureDetail detail : details) {
            features.add(detail.getFeature());
        }
        return features;
    }

    /** All faces with bounding boxes — used for group photo / video frame matching. */
    public List<FaceFeatureDetail> extractAllFeatureDetails(Path imagePath, boolean sensitive) {
        Mat image = readImage(imagePath);
        if (image.empty()) {
            image.release();
            return List.of();
        }

        try {
            int minSize = sensitive ? minFaceSizeIdentify : minFaceSizeRegister;
            List<DetectedFace> faces = detectAllFaces(image, sensitive, minSize);
            List<FaceFeatureDetail> details = new ArrayList<>();
            int total = faces.size();

            for (int i = 0; i < faces.size(); i++) {
                DetectedFace detected = faces.get(i);
                Mat feature = featureFromFace(image, detected.faceRow());
                if (feature != null && !feature.empty()) {
                    details.add(FaceFeatureDetail.builder()
                            .feature(feature)
                            .faceIndex(i)
                            .totalFaces(total)
                            .boxX(detected.faceRow().get(0, 0)[0])
                            .boxY(detected.faceRow().get(0, 1)[0])
                            .boxW(detected.width())
                            .boxH(detected.height())
                            .build());
                }
                detected.faceRow().release();
            }
            return details;
        } finally {
            image.release();
        }
    }

    public float matchFeatures(Mat query, Mat reference) {
        if (query.cols() != reference.cols()) {
            return 0f;
        }
        if (useInsightFace() && activeOptionalEngine() != null) {
            float[] a = matToFloatArray(query);
            float[] b = matToFloatArray(reference);
            return activeOptionalEngine().match(a, b);
        }
        return (float) recognizer.match(query, reference, FaceRecognizerSF.FR_COSINE);
    }

    public List<Float> featureToList(Mat feature) {
        int dims = (int) (feature.total() * feature.channels());
        float[] data = new float[dims];
        feature.get(0, 0, data);
        List<Float> list = new ArrayList<>(dims);
        for (float v : data) {
            list.add(v);
        }
        return list;
    }

    public Mat listToFeature(List<Float> values) {
        Mat feature = new Mat(1, values.size(), CvType.CV_32F);
        float[] data = new float[values.size()];
        for (int i = 0; i < values.size(); i++) {
            data[i] = values.get(i);
        }
        feature.put(0, 0, data);
        return feature;
    }

    private Mat featureFromFace(Mat image, Mat faceRow) {
        Mat aligned = new Mat();
        recognizer.alignCrop(image, faceRow, aligned);
        OptionalFaceEngine engine = useInsightFace() ? activeOptionalEngine() : null;
        if (engine != null) {
            Mat resized = new Mat();
            org.opencv.imgproc.Imgproc.resize(aligned, resized, new Size(112, 112));
            aligned.release();
            float[] embedding = engine.embedAlignedFace(resized);
            resized.release();
            if (embedding == null) {
                return new Mat();
            }
            Mat feature = new Mat(1, embedding.length, CvType.CV_32F);
            feature.put(0, 0, embedding);
            return feature;
        }
        Mat feature = new Mat();
        recognizer.feature(aligned, feature);
        aligned.release();
        return feature;
    }

    private OptionalFaceEngine activeOptionalEngine() {
        if (optionalEngines == null) {
            return null;
        }
        return optionalEngines.stream().filter(OptionalFaceEngine::isActive).findFirst().orElse(null);
    }

    private static float[] matToFloatArray(Mat mat) {
        int dims = (int) (mat.total() * mat.channels());
        float[] data = new float[dims];
        mat.get(0, 0, data);
        return data;
    }

    private List<DetectedFace> detectAllFaces(Mat image, boolean includeSensitivePass, int minFaceSize) {
        List<DetectedFace> found = new ArrayList<>();
        collectFaces(image, standardDetector, minFaceSize, found);

        if (includeSensitivePass) {
            collectFaces(image, sensitiveDetector, minFaceSize, found);
        }

        found.sort(Comparator.comparingDouble(DetectedFace::score).reversed());

        List<DetectedFace> unique = new ArrayList<>();
        for (DetectedFace face : found) {
            if (unique.size() >= MAX_FACES_PER_IMAGE) {
                face.faceRow().release();
                continue;
            }
            if (!overlapsExisting(face, unique)) {
                unique.add(face);
            } else {
                face.faceRow().release();
            }
        }
        return unique;
    }

    private void collectFaces(Mat image, FaceDetectorYN detector, int minFaceSize, List<DetectedFace> out) {
        detector.setInputSize(new Size(image.cols(), image.rows()));
        Mat faces = new Mat();
        detector.detect(image, faces);
        if (faces.empty() || faces.rows() == 0) {
            faces.release();
            return;
        }

        for (int i = 0; i < faces.rows(); i++) {
            Mat row = faces.row(i).clone();
            double w = row.get(0, 2)[0];
            double h = row.get(0, 3)[0];
            double score = row.get(0, 14)[0];
            if (w >= minFaceSize && h >= minFaceSize) {
                out.add(new DetectedFace(row, score));
            } else {
                row.release();
            }
        }
        faces.release();
    }

    private boolean overlapsExisting(DetectedFace candidate, List<DetectedFace> existing) {
        double cx = candidate.centerX();
        double cy = candidate.centerY();
        for (DetectedFace other : existing) {
            double dx = cx - other.centerX();
            double dy = cy - other.centerY();
            double minDist = Math.min(candidate.width(), candidate.height()) * 0.35;
            if (Math.hypot(dx, dy) < minDist) {
                return true;
            }
        }
        return false;
    }

    private void ensureModel(String url, Path target) throws IOException, InterruptedException {
        if (Files.exists(target) && Files.size(target) > 100_000) {
            return;
        }
        log.info("Downloading face AI model: {}", target.getFileName());
        HttpClient client = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(30))
                .followRedirects(HttpClient.Redirect.NORMAL)
                .build();
        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(url))
                .timeout(Duration.ofMinutes(5))
                .GET()
                .build();
        HttpResponse<InputStream> response = client.send(request, HttpResponse.BodyHandlers.ofInputStream());
        if (response.statusCode() != 200) {
            throw new IOException("Model download failed (" + response.statusCode() + "): " + url);
        }
        Files.createDirectories(target.getParent());
        try (InputStream in = response.body()) {
            Files.copy(in, target, java.nio.file.StandardCopyOption.REPLACE_EXISTING);
        }
        log.info("Downloaded model: {} ({} bytes)", target.getFileName(), Files.size(target));
    }

    private record DetectedFace(Mat faceRow, double score) {
        double width() {
            return faceRow.get(0, 2)[0];
        }

        double height() {
            return faceRow.get(0, 3)[0];
        }

        double centerX() {
            return faceRow.get(0, 0)[0] + width() * 0.5;
        }

        double centerY() {
            return faceRow.get(0, 1)[0] + height() * 0.5;
        }
    }
}
