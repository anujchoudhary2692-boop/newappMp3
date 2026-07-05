package com.mediaapp.service;

import org.opencv.core.Mat;

/**
 * Optional high-accuracy face engine. Activated when {@code app.face.engine=insightface}
 * and the backend is built with {@code mvn -Pinsightface package}.
 */
public interface OptionalFaceEngine {
    boolean isActive();

    String getStatusMessage();

    float getMatchThreshold();

    float[] embedAlignedFace(Mat alignedBgr112);

    float match(float[] a, float[] b);
}
