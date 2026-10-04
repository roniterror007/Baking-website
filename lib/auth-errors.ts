type AuthFailure = { code?: string; status?: number; name?: string };
export function authErrorMessage(failure: AuthFailure, action: "login" | "register" | "link"): string {
  const messages: Record<string, string> = {
    weak_password: "This password does not meet the account security requirements. Choose a longer password with upper and lowercase letters, numbers and a symbol.",
    email_not_confirmed: "Confirm your email before signing in. Check your inbox and spam folder for the activation link.",
    invalid_credentials: "The email or password is incorrect. If this is your first visit, create an account and confirm your email first.",
    email_address_invalid: "Enter a valid email address.",
    email_address_not_authorized: "The bakery's email service cannot send to this address yet. Please contact the bakery to complete email setup.",
    over_email_send_rate_limit: "The email service has reached its sending limit. Please wait before requesting another email.",
    over_request_rate_limit: "Too many attempts. Please wait a few minutes before trying again.",
    signup_disabled: "New account registration is currently disabled. Please contact the bakery.",
    email_provider_disabled: "Email accounts are currently disabled. Please contact the bakery.",
    user_already_exists: "Unable to create this account. Try signing in or requesting an email link.",
    captcha_failed: "Account verification could not be completed. Please contact the bakery.",
    unexpected_failure: "The account service could not complete this request. Please contact the bakery or try again later.",
  };
  const code = failure.code && /^[a-z_]{1,60}$/.test(failure.code) ? failure.code : undefined;
  const message = code && messages[code] || (failure.status === 401 || failure.status === 403
    ? "The account service is not configured correctly. Please contact the bakery."
    : failure.name === "AuthRetryableFetchError" || failure.name === "TypeError"
    ? "Unable to reach the account service. Check your connection and try again."
    : action === "register" ? "Unable to create an account. Please try again later or contact the bakery."
    : "Unable to sign in. Please try again later or contact the bakery.");
  return code ? `${message} (Reference: ${code})` : message;
}
