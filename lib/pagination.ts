type SearchParamValue = string | string[] | null | undefined;

export function parsePageParam(value: SearchParamValue, fallback = 1) {
  const raw = Array.isArray(value) ? value[0] : value;
  const parsed = Number.parseInt(raw ?? "", 10);

  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }

  return parsed;
}

export function paginateArray<T>(items: T[], requestedPage: number, pageSize: number) {
  const totalItems = items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const currentPage = Math.min(Math.max(requestedPage, 1), totalPages);
  const startIndex = totalItems === 0 ? 0 : (currentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalItems);

  return {
    items: items.slice(startIndex, endIndex),
    totalItems,
    pageSize,
    totalPages,
    currentPage,
    startIndex,
    endIndex,
    hasPreviousPage: currentPage > 1,
    hasNextPage: currentPage < totalPages,
  };
}

export function createSearchParams(params: Record<string, SearchParamValue>) {
  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value == null) {
      continue;
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        searchParams.append(key, item);
      }
      continue;
    }

    searchParams.set(key, value);
  }

  return searchParams;
}
