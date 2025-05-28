import { z } from 'zod';

export const clientSchema = z.object({
  firstName: z.string().min(1, { message: "First name is required." }).max(50, { message: "First name must be 50 characters or less." }),
  lastName: z.string().min(1, { message: "Last name is required." }).max(50, { message: "Last name must be 50 characters or less." }),
  email: z.string().email({ message: "Invalid email address." }),
  phoneNumber: z.string().min(7, { message: "Phone number must be at least 7 digits." }).max(15, { message: "Phone number must be 15 digits or less." }).regex(/^\+?[0-9\s-()]+$/, { message: "Invalid phone number format."}),
  paymentAmount: z.coerce.number().min(0.01, { message: "Payment amount must be greater than 0." }),
  paymentDayOfMonth: z.coerce.number().int().min(1, { message: "Day must be between 1 and 31." }).max(31, { message: "Day must be between 1 and 31." }),
});
