
import { z } from 'zod';
import type { ItemType } from '@/lib/types';

// Firebase Auth Schemas
export const signupSchema = z.object({
  email: z.string().email({ message: "Invalid email address." }),
  password: z.string().min(6, { message: "Password must be at least 6 characters long." }),
});
export type SignupFormValues = z.infer<typeof signupSchema>;

export const loginSchema = z.object({
  email: z.string().email({ message: "Invalid email address." }),
  password: z.string().min(1, { message: "Password is required." }),
});
export type LoginFormValues = z.infer<typeof loginSchema>;


// Data Schemas
export const addProductSchema = z.object({
  barcode: z.string().min(1, "Barcode is required."),
  productName: z.string().min(1, "Product name is required."),
  supplierName: z.string().min(1, "Supplier name is required. This name will be used to find an existing supplier or create a new one if it doesn't exist."),
  costPrice: z.coerce.number().nonnegative("Cost price must be a positive number.").optional(),
});
export type AddProductFormValues = z.infer<typeof addProductSchema>;

export const addInventoryItemSchema = z.object({
  staffName: z.string().min(1, "Staff name is required."),
  itemType: z.enum(['Expiry', 'Damage'], { required_error: "Item type is required." }),
  barcode: z.string().min(1, "Barcode is required."),
  quantity: z.coerce.number().int().min(1, "Quantity must be a whole number and at least 1."),
  expiryDate: z.date({ required_error: "A date is required for this item."}), 
  location: z.string().min(1, "Location is required."),
});
export type AddInventoryItemFormValues = z.infer<typeof addInventoryItemSchema>;


export const addSupplierSchema = z.object({
  supplierName: z.string().min(1, "Supplier name is required."),
});
export type AddSupplierFormValues = z.infer<typeof addSupplierSchema>;

export const editInventoryItemSchema = z.object({
  itemId: z.string().min(1, "Item ID is required."),
  location: z.string().min(1, "Location is required."),
  itemType: z.enum(['Expiry', 'Damage'], { required_error: "Item type is required." }),
  quantity: z.coerce.number().int().min(0, "Quantity must be a whole number and not negative."),
  expiryDate: z.date().nullable().optional(), // Can be null if itemType is 'Damage'
}).refine(data => {
  if (data.itemType === 'Expiry' && !data.expiryDate) {
    return false; // If type is Expiry, expiryDate must be provided
  }
  return true;
}, {
  message: "Expiry date is required when item type is 'Expiry'.",
  path: ['expiryDate'],
});
export type EditInventoryItemFormValues = z.infer<typeof editInventoryItemSchema>;

export const editSupplierSchema = z.object({
  supplierId: z.string().min(1, "Supplier ID is required for tracking."), // Original ID for client tracking
  currentSupplierName: z.string().min(1, "Current supplier name is required."),
  newSupplierName: z.string().min(1, "New supplier name is required.").refine(val => val.trim().length > 0, {
    message: "New supplier name cannot be empty.",
  }),
});
export type EditSupplierFormValues = z.infer<typeof editSupplierSchema>;

export const localCredentialsSchema = z.object({
  username: z.string().min(1, "Username is required."),
  password: z.string().min(1, "Password is required."),
});
export type LocalCredentialsFormValues = z.infer<typeof localCredentialsSchema>;
