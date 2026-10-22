package com.qoj.module.agent.service;

import com.openai.errors.OpenAIServiceException;
import java.io.InterruptedIOException;
import java.net.SocketTimeoutException;
import java.net.http.HttpTimeoutException;
import java.util.Collections;
import java.util.IdentityHashMap;
import java.util.Locale;
import java.util.Set;
import java.util.concurrent.CancellationException;
import java.util.concurrent.TimeoutException;

/** Recognizes transport and Reactor timeouts through SDK wrappers, without treating cancellation as timeout. */
public final class AgentTimeouts {
    private AgentTimeouts() {}

    public static boolean isTimeout(Throwable error) {
        Set<Throwable> visited = Collections.newSetFromMap(new IdentityHashMap<>());
        boolean timeout = false;
        for (Throwable cause = error; cause != null && visited.add(cause); cause = cause.getCause()) {
            if (cause instanceof AgentRunStoppedException || cause instanceof InterruptedException
                || cause instanceof CancellationException) return false;
            if (cause instanceof TimeoutException || cause instanceof SocketTimeoutException
                || cause instanceof HttpTimeoutException) timeout = true;
            if (cause instanceof OpenAIServiceException service
                && (service.statusCode() == 408 || service.statusCode() == 504)) timeout = true;
            String message = cause.getMessage();
            if (message != null) {
                String normalized = message.toLowerCase(Locale.ROOT);
                if (cause instanceof InterruptedIOException
                    && (normalized.contains("timeout") || normalized.contains("timed out"))) timeout = true;
                if (cause instanceof IllegalStateException && normalized.startsWith("timeout on blocking read")) timeout = true;
            }
        }
        return timeout;
    }
}
