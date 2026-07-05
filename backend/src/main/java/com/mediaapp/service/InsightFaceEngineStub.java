package com.mediaapp.service;

import lombok.extern.slf4j.Slf4j;
import org.opencv.core.Mat;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@ConditionalOnProperty(name = "app.face.engine", havingValue = "insightface")
public class InsightFaceEngineStub implements OptionalFaceEngine {

    @Value("${app.face.insightface-match-threshold:0.42}")
    private float insightfaceMatchThreshold;

    public InsightFaceEngineStub() {
        log.warn(
                "FACE_ENGINE=insightface but ONNX Runtime not on classpath. "
                        + "Rebuild with: mvn -Pinsightface package. Falling back to OpenCV SFace.");
    }

    @Override
    public boolean isActive() {
        return false;
    }

    @Override
    public String getStatusMessage() {
        return "InsightFace requested — rebuild with -Pinsightface for ONNX support";
    }

    @Override
    public float getMatchThreshold() {
        return insightfaceMatchThreshold;
    }

    @Override
    public float[] embedAlignedFace(Mat alignedBgr112) {
        return null;
    }

    @Override
    public float match(float[] a, float[] b) {
        return 0f;
    }
}
