package com.mediaapp.config;

import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import javax.jmdns.JmDNS;
import javax.jmdns.ServiceInfo;
import java.io.IOException;
import java.net.InetAddress;
import java.util.HashMap;
import java.util.Map;

/**
 * Advertises the backend on the local network via mDNS/Bonjour (_mediaface._tcp)
 * so mobile clients can connect without a hardcoded IP address.
 */
@Slf4j
@Component
@ConditionalOnProperty(name = "app.discovery.bonjour-enabled", havingValue = "true", matchIfMissing = true)
public class BonjourAdvertiser {

    private static final String SERVICE_TYPE = "_mediaface._tcp.local.";
    private static final String SERVICE_NAME = "MediaFace";

    @Value("${server.port:8080}")
    private int serverPort;

    private JmDNS jmdns;
    private ServiceInfo serviceInfo;

    @PostConstruct
    void register() {
        try {
            InetAddress address = InetAddress.getLocalHost();
            jmdns = JmDNS.create(address);
            Map<String, String> props = new HashMap<>();
            props.put("path", "/api/health");
            props.put("app", "MediaFace");
            serviceInfo = ServiceInfo.create(SERVICE_TYPE, SERVICE_NAME, serverPort, 0, 0, props);
            jmdns.registerService(serviceInfo);
            log.info(
                    "Bonjour service registered: {} on port {} ({})",
                    SERVICE_NAME,
                    serverPort,
                    address.getHostAddress());
        } catch (IOException e) {
            log.warn("Bonjour registration failed (LAN auto-discovery disabled): {}", e.getMessage());
        }
    }

    @PreDestroy
    void shutdown() {
        try {
            if (jmdns != null) {
                if (serviceInfo != null) {
                    jmdns.unregisterService(serviceInfo);
                }
                jmdns.close();
            }
        } catch (IOException e) {
            log.debug("Bonjour shutdown: {}", e.getMessage());
        }
    }
}
