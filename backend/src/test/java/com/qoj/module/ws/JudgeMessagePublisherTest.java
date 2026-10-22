package com.qoj.module.ws;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;

class JudgeMessagePublisherTest {
    private final SimpMessagingTemplate template = mock(SimpMessagingTemplate.class);
    private final JudgeMessagePublisher publisher = new JudgeMessagePublisher(template);

    @AfterEach
    void clearTransaction() {
        TransactionSynchronizationManager.clear();
    }

    @Test
    void resultAndQueueMessagesWaitForCommit() {
        TransactionSynchronizationManager.setActualTransactionActive(true);
        TransactionSynchronizationManager.initSynchronization();
        publisher.submissionChanged(7L, "AC", 10, 20);
        verifyNoInteractions(template);
        for (TransactionSynchronization synchronization : TransactionSynchronizationManager.getSynchronizations()) {
            synchronization.afterCommit();
        }
        verify(template).convertAndSend(eq("/topic/submissions/7"), any(Object.class), any(java.util.Map.class));
        verify(template).convertAndSend(eq("/topic/submission-queue"), any(Object.class), any(java.util.Map.class));
    }

    @Test
    void rollbackDoesNotPublish() {
        TransactionSynchronizationManager.setActualTransactionActive(true);
        TransactionSynchronizationManager.initSynchronization();
        publisher.submissionChanged(7L, "WA", null, null);
        publisher.submissionQueueUpdated();
        for (TransactionSynchronization synchronization : TransactionSynchronizationManager.getSynchronizations()) {
            synchronization.afterCompletion(TransactionSynchronization.STATUS_ROLLED_BACK);
        }
        verifyNoInteractions(template);
    }

    @Test
    void alreadyCommittedAutocommitPathPublishesImmediately() {
        publisher.submissionChanged(7L, "TLE", null, null);
        verify(template).convertAndSend(eq("/topic/submissions/7"), any(Object.class), any(java.util.Map.class));
        verify(template).convertAndSend(eq("/topic/submission-queue"), any(Object.class), any(java.util.Map.class));
    }
}
