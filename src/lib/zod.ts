import { z } from 'zod';

/**
 * Form validation messages are i18n keys (`validation.*`, resolved by <FormMessage/>) instead of zod's English text.
 * Schema-level messages (`z.string().min(1, 'validation.required')`) win over this default.
 */
export function configureZod() {
  z.config({
    customError: (iss) => {
      switch (iss.code) {
        case 'invalid_type':
          return iss.input === undefined || iss.input === null ? 'validation.required' : 'validation.invalid';
        case 'too_small':
          return iss.origin === 'string' && Number(iss.minimum) <= 1
            ? 'validation.required'
            : 'validation.tooSmall';
        case 'too_big':
          return 'validation.tooBig';
        case 'invalid_format':
          return iss.format === 'email' ? 'validation.email' : 'validation.invalid';
        default:
          return 'validation.invalid';
      }
    },
  });
}
