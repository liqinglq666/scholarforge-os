export interface ExportExecutionResult {
  ok: boolean;
  message: string;
}

export async function runExportAction(
  action: () => void | Promise<void>,
  successMessage: string,
): Promise<ExportExecutionResult> {
  try {
    await action();
    return { ok: true, message: successMessage };
  } catch (error) {
    const detail = error instanceof Error ? error.message.trim() : '';
    return {
      ok: false,
      message: detail ? `导出失败：${detail}` : '导出失败，请重试。',
    };
  }
}
