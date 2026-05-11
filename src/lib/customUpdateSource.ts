type UpdateDisabledPayload = {
  needUpdate: false;
  latestVersion: string;
  reinstall: false;
  time: null;
  version: string;
  customSourceConfigured: false;
  message: string;
};

function normalizeUrl(url?: string | null): string | null {
  const value = url?.trim();
  return value ? value : null;
}

export function getConfiguredCustomUpdateUrl(urlOverride?: string | null): string | null {
  return normalizeUrl(urlOverride) ?? normalizeUrl(process.env.TOONFLOW_CUSTOM_UPDATE_URL);
}

export function buildCustomUpdateDisabledPayload(currentVersion: string): UpdateDisabledPayload {
  return {
    needUpdate: false,
    latestVersion: currentVersion,
    reinstall: false,
    time: null,
    version: currentVersion,
    customSourceConfigured: false,
    message: "未配置自定义更新源，官方更新已停用。请先配置 TOONFLOW_CUSTOM_UPDATE_URL。",
  };
}

export function getAllowedUpdateOrigin(urlOverride?: string | null): string | null {
  const updateUrl = getConfiguredCustomUpdateUrl(urlOverride);
  if (!updateUrl) return null;
  return new URL(updateUrl).origin;
}

export function isAllowedCustomDownloadUrl(downloadUrl: string): boolean {
  const allowedOrigin = getAllowedUpdateOrigin();
  if (!allowedOrigin) return false;
  try {
    return new URL(downloadUrl).origin === allowedOrigin;
  } catch {
    return false;
  }
}
