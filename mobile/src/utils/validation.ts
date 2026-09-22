const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateLogin(email: string, password: string): string | null {
  if (!emailPattern.test(email.trim())) {
    return 'Enter a valid email address.';
  }
  if (!password) {
    return 'Enter your password.';
  }
  return null;
}

export function validateRegister(input: {
  fullName: string;
  email: string;
  password: string;
  phone: string;
}): string | null {
  if (input.fullName.trim().length < 2) {
    return 'Enter your full name.';
  }
  if (!emailPattern.test(input.email.trim())) {
    return 'Enter a valid email address.';
  }
  if (
    input.password.length < 8 ||
    !/[A-Za-z]/.test(input.password) ||
    !/[0-9]/.test(input.password)
  ) {
    return 'Use at least 8 characters, including a letter and a number.';
  }
  if (input.phone.trim() && !/^\+?[0-9][0-9\s()-]{6,}$/.test(input.phone.trim())) {
    return 'Enter a valid phone number, or leave it blank.';
  }
  return null;
}
