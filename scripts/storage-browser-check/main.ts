import {
    requireIsolatedOrigin,
    runStorageChecks,
    type CheckReport,
} from './checks';
const button = document.getElementById('run') as HTMLButtonElement;
const status = document.getElementById('status')!;
const list = document.getElementById('checks')!;
const output = document.getElementById('evidence')!;
const reports = new Map<string, CheckReport>();
function render(report: CheckReport): void {
    reports.set(report.name, report);
    list.replaceChildren(
        ...Array.from(reports.values(), (item) => {
            const node = document.createElement('li');
            node.className = item.status;
            node.textContent = `${item.status.toUpperCase()}: ${item.name}`;
            return node;
        }),
    );
    status.textContent =
        report.status === 'running'
            ? `Running: ${report.name}`
            : report.status === 'failed'
              ? `Failed: ${report.name}`
              : `Passed: ${report.name}`;
    output.textContent = JSON.stringify(Array.from(reports.values()), null, 2);
}
try {
    requireIsolatedOrigin();
} catch (error) {
    button.disabled = true;
    status.textContent = String(error);
}
button.addEventListener('click', () => {
    button.disabled = true;
    reports.clear();
    list.replaceChildren();
    void runStorageChecks(render)
        .then((evidence) => {
            status.textContent = `All ${reports.size} native IndexedDB storage checks passed.`;
            output.textContent = JSON.stringify(evidence, null, 2);
        })
        .catch((error) => {
            status.textContent = `Storage checks failed: ${error instanceof Error ? error.message : String(error)}`;
            output.textContent = JSON.stringify(
                {
                    complete: false,
                    error: error instanceof Error ? error.stack : String(error),
                    checks: Array.from(reports.values()),
                },
                null,
                2,
            );
        })
        .finally(() => {
            button.disabled = false;
        });
});
