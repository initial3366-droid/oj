package com.qoj.module.judge.gojudge;

import com.qoj.common.enums.SubmissionStatus;
import com.qoj.module.judge.JudgeCaseResult;
import com.qoj.module.judge.JudgeResult;
import com.qoj.module.judge.JudgeTask;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;
import java.util.concurrent.CancellationException;
import java.util.function.BooleanSupplier;

/** One deadline and claim fence shared by compiler, contestant and checker requests. */
public final class JudgeExecutionBudget implements AutoCloseable {
    private static final ThreadLocal<JudgeExecutionBudget> CURRENT = new ThreadLocal<>();
    private final long deadline;
    private final BooleanSupplier ownsClaim;

    public JudgeExecutionBudget(long milliseconds, BooleanSupplier ownsClaim) {
        this.deadline = System.nanoTime() + Duration.ofMillis(milliseconds).toNanos();
        this.ownsClaim = ownsClaim;
        CURRENT.set(this);
    }

    public static Duration remaining(Duration requested) {
        JudgeExecutionBudget budget = CURRENT.get();
        if (budget == null) return requested;
        if (!budget.ownsClaim.getAsBoolean()) throw new CancellationException("Judge claim lost");
        long nanos = budget.deadline - System.nanoTime();
        if (nanos <= 0) throw new Exceeded();
        return Duration.ofNanos(Math.min(nanos, requested.toNanos()));
    }

    public static JudgeResult exceeded(JudgeTask task, List<JudgeCaseResult> completed) {
        List<JudgeCaseResult> cases = new ArrayList<>(completed);
        Set<Integer> completedCases = completed.stream().map(JudgeCaseResult::caseNo).collect(Collectors.toSet());
        for (var test : task.testCases()) {
            if (!completedCases.contains(test.caseNo())) {
                cases.add(new JudgeCaseResult(test.caseNo(), SubmissionStatus.TLE, 0, 0,
                    null, null, null, "Submission execution budget exceeded"));
            }
        }
        int time = completed.stream().mapToInt(item -> item.timeMs() == null ? 0 : item.timeMs()).max().orElse(0);
        int memory = completed.stream().mapToInt(item -> item.memoryKb() == null ? 0 : item.memoryKb()).max().orElse(0);
        return new JudgeResult(SubmissionStatus.TLE, "Submission execution budget exceeded", time, memory, cases);
    }

    @Override
    public void close() { CURRENT.remove(); }

    public static final class Exceeded extends RuntimeException { }
}
