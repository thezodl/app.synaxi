/**
 * An error whose message is safe to show the user (never contains a feed URL). `withUser` turns it
 * into `{ error: message }` with `status`.
 */
export class UserError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
  }
}
