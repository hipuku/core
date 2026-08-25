import styles from "./DemoCredentials.module.css";

/**
 * The way in, on the page where someone needs it.
 *
 * A public demo whose credentials live in a README is not a demo — the person
 * evaluating this arrived from a link and will not go hunting. Shown only where
 * sign-up is closed, so it never appears on a local install.
 */
export function DemoCredentials({
  email,
  password,
}: {
  email: string;
  password: string;
}) {
  return (
    <div className={styles.card}>
      <p className={styles.lead}>
        <strong>Read-only demo.</strong> Sign in with these to look around. You
        can write and save drafts; the decision log itself stays as it is.
      </p>
      <dl className={styles.creds}>
        <dt>Email</dt>
        <dd>{email}</dd>
        <dt>Password</dt>
        <dd>{password}</dd>
      </dl>
    </div>
  );
}
