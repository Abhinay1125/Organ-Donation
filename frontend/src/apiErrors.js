export async function getApiError(response, resource) {
  if (response.status === 403) {
    return `You do not have permission to access ${resource}.`;
  }
  if (response.status === 404) {
    return `${resource} could not be found.`;
  }

  let detail = '';
  try {
    const body = await response.json();
    detail = typeof body.detail === 'string'
      ? body.detail
      : Array.isArray(body.detail)
        ? body.detail.map(issue => {
          const field = Array.isArray(issue.loc)
            ? issue.loc.filter(part => part !== 'body').join('.')
            : '';
          const message = issue.msg === 'Field required' ? 'is required' : issue.msg;
          return field ? `${field} ${message}` : message;
        }).filter(Boolean).join(' ')
        : '';
  } catch {
    detail = '';
  }

  if (response.status === 422) {
    return detail ? `Please check the submitted information: ${detail}` : 'Please check the submitted information.';
  }
  return detail || `Unable to load ${resource} (HTTP ${response.status}).`;
}
