"use server";

import { suggestRelatedProducts } from "@/ai/flows/suggest-related-products";
import { getProductsByNames } from "@/lib/products";
import type { Product } from "@/lib/types";

export async function getSuggestedProductsAction(productNames: string[]): Promise<{ products: Product[], error?: string }> {
  if (productNames.length === 0) {
    return { products: [] };
  }

  try {
    const result = await suggestRelatedProducts({ cartItems: productNames });
    if (result.suggestedProducts && result.suggestedProducts.length > 0) {
      // Filter out products already in the cart
      const currentProductNamesLower = productNames.map(name => name.toLowerCase());
      const filteredSuggestions = result.suggestedProducts.filter(
        suggestion => !currentProductNamesLower.includes(suggestion.toLowerCase())
      );
      
      const suggestedProducts = getProductsByNames(filteredSuggestions);
      return { products: suggestedProducts.slice(0, 3) }; // Limit to 3 suggestions
    }
    return { products: [] };
  } catch (error) {
    console.error("Error fetching suggested products:", error);
    return { products: [], error: "Could not fetch suggestions at this time." };
  }
}
