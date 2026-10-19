/** RFC 9457 problem details as returned by the Strata API. */
export interface ProblemDetails {
  type?: string;
  title?: string;
  status?: number;
  detail?: string;
  /** Content-validation failures (422) list each violation here. */
  errors?: ContentViolation[];
  [extension: string]: unknown;
}

export interface ContentViolation {
  code: string;
  path: string;
  message: string;
}

/** Thrown for any non-2xx response so TanStack Query treats it as an error. */
export class ApiError extends Error {
  readonly status: number;
  readonly problem: ProblemDetails;

  constructor(status: number, problem: ProblemDetails) {
    super(problem.title ?? `Request failed with status ${status}`);
    this.name = "ApiError";
    this.status = status;
    this.problem = problem;
  }

  get isConflict(): boolean {
    return this.status === 409;
  }

  get isValidation(): boolean {
    return this.status === 422;
  }
}

export function isProblemDetails(value: unknown): value is ProblemDetails {
  return typeof value === "object" && value !== null && ("title" in value || "status" in value);
}
