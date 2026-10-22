package com.qoj.module.agent.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletResponse;
import java.io.BufferedWriter;
import java.io.IOException;
import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ScheduledFuture;
import org.springframework.scheduling.TaskScheduler;

/** Serializes heartbeats and SSE events, and cancels the scheduled writer before the stream closes. */
final class AgentChatEventStream implements AutoCloseable {
    private final BufferedWriter writer;
    private final ObjectMapper json;
    private final HttpServletResponse response;
    private final ScheduledFuture<?> heartbeat;
    private volatile IOException failure;
    private boolean closed;

    AgentChatEventStream(BufferedWriter writer, ObjectMapper json, TaskScheduler scheduler,
                         HttpServletResponse response) {
        this.writer = writer;
        this.json = json;
        this.response = response;
        Duration interval = Duration.ofSeconds(15);
        heartbeat = scheduler.scheduleWithFixedDelay(this::heartbeat, Instant.now().plus(interval), interval);
    }

    synchronized void event(String event, Map<String, ?> data) throws IOException {
        if (failure != null) throw failure;
        if (closed) throw new IOException("Agent stream closed");
        try {
            writer.write("event: " + event + "\ndata: " + json.writeValueAsString(data) + "\n\n");
            writer.flush();
            response.flushBuffer();
        } catch (IOException e) {
            failure = e;
            throw e;
        }
    }

    private synchronized void heartbeat() {
        if (closed || failure != null) return;
        try {
            writer.write(": heartbeat\n\n");
            writer.flush();
            response.flushBuffer();
        } catch (IOException e) {
            failure = e;
            heartbeat.cancel(false);
        }
    }

    boolean disconnected() { return failure != null; }

    @Override
    public synchronized void close() {
        closed = true;
        heartbeat.cancel(false);
    }
}
