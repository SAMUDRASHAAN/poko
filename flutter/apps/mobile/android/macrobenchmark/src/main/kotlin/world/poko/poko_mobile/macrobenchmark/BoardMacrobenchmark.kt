package world.poko.poko_mobile.macrobenchmark

import androidx.benchmark.macro.BaselineProfileMode
import androidx.benchmark.macro.CompilationMode
import androidx.benchmark.macro.ExperimentalMetricApi
import androidx.benchmark.macro.FrameTimingMetric
import androidx.benchmark.macro.MacrobenchmarkScope
import androidx.benchmark.macro.MemoryUsageMetric
import androidx.benchmark.macro.StartupMode
import androidx.benchmark.macro.junit4.MacrobenchmarkRule
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.filters.LargeTest
import androidx.test.uiautomator.By
import androidx.test.uiautomator.UiObject2
import androidx.test.uiautomator.Until
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@LargeTest
@RunWith(AndroidJUnit4::class)
class BoardMacrobenchmark {
    @get:Rule
    val benchmarkRule = MacrobenchmarkRule()

    @Test
    @OptIn(ExperimentalMetricApi::class)
    fun dragCommitRefillAndTargetRotation() {
        benchmarkRule.measureRepeated(
            packageName = TARGET_PACKAGE,
            metrics =
                listOf(
                    FrameTimingMetric(),
                    MemoryUsageMetric(MemoryUsageMetric.Mode.Max),
                ),
            compilationMode =
                CompilationMode.Partial(
                    baselineProfileMode = BaselineProfileMode.Disable,
                    warmupIterations = 1,
                ),
            startupMode = StartupMode.WARM,
            iterations = MEASURED_ITERATIONS,
            setupBlock = { pressHome() },
        ) {
            startActivityAndWait()
            requireMarker(READY_MARKER)
            requireMarker(RIVE_READY_MARKER)

            repeat(CYCLES_PER_ITERATION) { cycle ->
                val path =
                    PATH_MARKERS
                        .map { marker -> requireObject(marker) }
                        .map { it.visibleCenter }
                        .toTypedArray()
                check(device.swipe(path, SWIPE_STEPS_PER_SEGMENT)) {
                    "Gate 2 drag injection failed for cycle ${cycle + 1}."
                }

                val completed = cycle + 1
                requireMarker("$COMMIT_MARKER_PREFIX$completed")
                requireMarker("$REFILL_MARKER_PREFIX$completed")
                requireMarker("$TARGET_ROTATION_MARKER_PREFIX$completed")
                requireMarker("$ASSERTIONS_MARKER_PREFIX$completed")
            }
        }
    }

    private fun MacrobenchmarkScope.requireMarker(description: String) {
        check(device.wait(Until.hasObject(By.desc(description)), MARKER_TIMEOUT_MS) == true) {
            "Timed out waiting for semantic marker: $description"
        }
    }

    private fun MacrobenchmarkScope.requireObject(description: String): UiObject2 =
        checkNotNull(device.wait(Until.findObject(By.desc(description)), MARKER_TIMEOUT_MS)) {
            "Timed out waiting for semantic object: $description"
        }

    private companion object {
        const val TARGET_PACKAGE = "world.poko.poko_mobile"
        const val READY_MARKER = "Poko Gate 2 board ready"
        const val RIVE_READY_MARKER = "Poko Gate 2 Rive ready"
        const val COMMIT_MARKER_PREFIX = "Poko Gate 2 commits "
        const val REFILL_MARKER_PREFIX = "Poko Gate 2 refills "
        const val TARGET_ROTATION_MARKER_PREFIX = "Poko Gate 2 target rotations "
        const val ASSERTIONS_MARKER_PREFIX = "Poko Gate 2 assertions passed "
        const val MEASURED_ITERATIONS = 5
        const val CYCLES_PER_ITERATION = 12
        const val SWIPE_STEPS_PER_SEGMENT = 12
        const val MARKER_TIMEOUT_MS = 5_000L

        val PATH_MARKERS =
            listOf(
                "Poko Gate 2 path 0",
                "Poko Gate 2 path 1",
                "Poko Gate 2 path 2",
                "Poko Gate 2 path 3",
            )
    }
}
