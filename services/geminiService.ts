

import { SchemaType } from "@google/generative-ai";
import type { Vehicle, ProsAndCons, Conversation, Suggestion } from '../types';
import type { SearchFilters } from "../types";

/**
 * A helper function to call our secure backend proxy for the Gemini API.
 * @param payload - The complete request object for the Gemini API (model, contents, config).
 * @returns The text result from the Gemini API.
 */
async function callGeminiAPI(payload: any): Promise<string> {
    try {
        const response = await fetch('/api/gemini', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ payload }),
        });

        if (!response.ok) {
            // Handle 404 specifically (API endpoint not available in dev)
            if (response.status === 404) {
                console.warn('⚠️ Gemini API endpoint not available (dev mode). AI features disabled.');
                throw new Error('AI_API_UNAVAILABLE');
            }
            
            // Check if response is JSON before trying to parse
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                const errorBody = await response.json().catch(() => ({ error: `API error: ${response.statusText}` }));
                throw new Error(errorBody.error || `API error: ${response.statusText}`);
            } else {
                // If not JSON, return a generic error
                throw new Error(`API error: ${response.status} - ${response.statusText}`);
            }
        }

        // Check if response is JSON before parsing
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
            throw new Error('API returned non-JSON response');
        }

        const data = await response.json();
        return data.response || data.result || 'No response generated';
    } catch (error) {
        // Only log as error if it's not a 404 (expected in dev)
        if (error instanceof Error && error.message === 'AI_API_UNAVAILABLE') {
            // Silently fail for dev mode - don't spam console
        } else {
            console.warn("⚠️ Gemini API error (may be unavailable in dev):", error instanceof Error ? error.message : error);
        }
        // Return a default value that won't break the UI.
        const isJson = payload.config?.responseMimeType === "application/json";
        if (isJson) {
            // Check if the expected response is an array or object
            return payload.config?.responseSchema?.type === SchemaType.ARRAY ? "[]" : "{}";
        }
        // For non-JSON responses, return a user-friendly message
        return "AI service is temporarily unavailable. Please try again later.";
    }
}


export const parseSearchQuery = async (query: string): Promise<SearchFilters> => {
    const prompt = `Parse the user's vehicle search query and extract structured filter criteria.
    The user's query is: "${query}".
    - If the user mentions a specific make or model, extract it.
    - If the user specifies a price range (e.g., "under ₹8 lakhs", "between 1000000 and 1500000"), extract the minPrice and maxPrice.
    - If the user mentions specific features (e.g., "with a sunroof", "has ADAS"), extract them into the features array.
    - The 'model' is the specific model of the car.
    Respond only with JSON matching the provided schema. If a value is not present, omit the key.`;

    const requestPayload = {
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: SchemaType.OBJECT,
                properties: {
                    make: { type: SchemaType.STRING, description: "The make of the car, e.g., Tata, Hyundai." },
                    model: { type: SchemaType.STRING, description: "The model of the car, e.g., Nexon, Creta." },
                    minPrice: { type: SchemaType.NUMBER, description: "The minimum price in INR." },
                    maxPrice: { type: SchemaType.NUMBER, description: "The maximum price in INR." },
                    features: {
                        type: SchemaType.ARRAY,
                        items: { type: SchemaType.STRING },
                        description: "An array of requested vehicle features, e.g., Sunroof, ADAS."
                    },
                },
            },
            thinkingConfig: { thinkingBudget: 0 },
        },
    };

    try {
        const jsonText = await callGeminiAPI(requestPayload);
        return JSON.parse(jsonText.trim());
    } catch (error) {
        console.error("Error parsing search query from proxy:", error);
        return {};
    }
};

export const generateProsAndCons = async (vehicle: Vehicle): Promise<ProsAndCons> => {
    const prompt = `Based on the following vehicle data, generate a balanced list of 3 pros and 3 cons.
Make: ${vehicle.make}, Model: ${vehicle.model}, Year: ${vehicle.year}.
The car has run ${vehicle.mileage} kms. Its fuel efficiency is ${vehicle.fuelEfficiency}.
Key features include: ${vehicle.features.join(', ')}.
Provide the output in JSON format with two keys: "pros" and "cons", each containing an array of strings.`;

    const requestPayload = {
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: SchemaType.OBJECT,
                properties: {
                    pros: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
                    cons: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } }
                }
            }
        }
    };

    try {
        const jsonText = await callGeminiAPI(requestPayload);
        return JSON.parse(jsonText.trim());
    } catch (error) {
        console.error("Failed to generate pros and cons from proxy:", error);
        return { pros: ['AI analysis unavailable.'], cons: ['Could not generate suggestions at this time.'] };
    }
};

export const generateVehicleDescription = async (vehicle: Partial<Vehicle>): Promise<string> => {
    if (!vehicle.make || !vehicle.model || !vehicle.year) {
        return "Please provide Make, Model, and Year for an accurate description.";
    }

    const prompt = `Generate a detailed and appealing vehicle description for an online marketplace, targeting an Indian audience. The description should be well-structured, easy to read, and highlight the vehicle's key selling points.
    
    Here is the vehicle data:
    - Make: ${vehicle.make}
    - Model: ${vehicle.model}
    - Variant: ${vehicle.variant || 'N/A'}
    - Year: ${vehicle.year}
    - Price: ₹${vehicle.price?.toLocaleString('en-IN')}
    - Mileage: ${vehicle.mileage?.toLocaleString('en-IN')} kms
    - Fuel Type: ${vehicle.fuelType}
    - Transmission: ${vehicle.transmission}
    - Color: ${vehicle.color}
    - No. of Owners: ${vehicle.noOfOwners}
    - Key Features: ${vehicle.features?.join(', ')}

    Follow these instructions:
    1. Start with a strong, catchy opening sentence.
    2. Write a paragraph detailing the vehicle's condition, performance, and key features. Mention its suitability for different types of buyers (e.g., for a family, for city driving).
    3. Use bullet points to list 3-5 of the most attractive features.
    4. Conclude with a sentence that encourages buyers to take action (e.g., "Don't miss out on this well-maintained vehicle!").
    5. The tone should be professional yet persuasive. Avoid overly technical jargon.
    6. The total length should be around 3-4 paragraphs, including the bullet points.
    7. Ensure the output is just the description text, without any introductory phrases like "Here is the description:".`;

    const requestPayload = {
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
            thinkingConfig: { thinkingBudget: 0 },
        },
    };
    
    const descriptionText = await callGeminiAPI(requestPayload);
    if (descriptionText.startsWith("Error:")) {
        return "Failed to generate AI description. Please write one manually.";
    }
    return descriptionText.trim();
};

export const getAiVehicleSuggestions = async (
    vehicle: { make: string, model: string, variant?: string, year: number }
): Promise<{
    structuredSpecs: Partial<Pick<Vehicle, 'engine' | 'transmission' | 'fuelType' | 'fuelEfficiency' | 'displacement' | 'groundClearance' | 'bootSpace'>>;
    featureSuggestions: Record<string, string[]>;
}> => {
    const prompt = `For a ${vehicle.year} ${vehicle.make} ${vehicle.model} ${vehicle.variant || ''} in the Indian market, provide:
1.  Key technical specifications.
2.  A list of common features, categorized.

Respond ONLY with a single JSON object matching this schema. If a value is not applicable or commonly available, return "N/A" for specs or an empty array for features.
- The root object should have two keys: "structuredSpecs" and "featureSuggestions".
- "structuredSpecs" should be an object with keys: "engine", "transmission", "fuelType", "fuelEfficiency", "displacement", "groundClearance", "bootSpace".
- "featureSuggestions" should be an object where keys are categories like "Comfort & Convenience", "Safety", "Entertainment", and "Exterior", and values are arrays of feature strings.`;
    
    const requestPayload = {
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: SchemaType.OBJECT,
                properties: {
                    structuredSpecs: {
                        type: SchemaType.OBJECT,
                        properties: {
                            engine: { type: SchemaType.STRING },
                            transmission: { type: SchemaType.STRING },
                            fuelType: { type: SchemaType.STRING },
                            fuelEfficiency: { type: SchemaType.STRING },
                            displacement: { type: SchemaType.STRING },
                            groundClearance: { type: SchemaType.STRING },
                            bootSpace: { type: SchemaType.STRING },
                        }
                    },
                    featureSuggestions: {
                        type: SchemaType.OBJECT,
                        properties: {
                            "Comfort & Convenience": { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
                            "Safety": { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
                            "Entertainment": { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
                            "Exterior": { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
                        },
                        additionalProperties: {
                            type: SchemaType.ARRAY,
                            items: { type: SchemaType.STRING }
                        }
                    }
                }
            },
            thinkingConfig: { thinkingBudget: 0 },
        }
    };

    try {
        const jsonText = await callGeminiAPI(requestPayload);
        const parsed = JSON.parse(jsonText.trim());
        return {
            structuredSpecs: parsed.structuredSpecs || {},
            featureSuggestions: parsed.featureSuggestions || {}
        };
    } catch (error) {
        console.error("Error fetching AI vehicle suggestions from proxy:", error);
        return { structuredSpecs: {}, featureSuggestions: { "Error": ["Could not fetch suggestions."] } };
    }
};

export const getSearchSuggestions = async (query: string, vehicles: Pick<Vehicle, 'make' | 'model' | 'features'>[]): Promise<string[]> => {
    if (!query.trim()) {
        return [];
    }

    const makes = [...new Set(vehicles.map(v => v.make))];
    const models = [...new Set(vehicles.map(v => v.model))];
    const features = [...new Set(vehicles.flatMap(v => v.features))];

    const prompt = `Based on the user's partial search query and the available vehicle inventory, generate up to 5 relevant and concise search suggestions.
Suggestions can be for makes, models, features, or common search phrases (e.g., "SUV with sunroof").
Prioritize suggestions that are highly relevant to the user's input.

User's partial query: "${query}"

Available makes: ${makes.slice(0, 15).join(', ')}
Available models: ${models.slice(0, 20).join(', ')}
Available features: ${features.slice(0, 20).join(', ')}

Return the suggestions as a JSON array of strings. For example: ["Hyundai Creta", "Sunroof", "under 15 lakhs"].`;

    const requestPayload = {
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: SchemaType.ARRAY,
                items: { type: SchemaType.STRING }
            },
            thinkingConfig: { thinkingBudget: 0 },
        }
    };
    
    try {
        const jsonText = await callGeminiAPI(requestPayload);
        return JSON.parse(jsonText.trim());
    } catch (error) {
        console.error("Error fetching search suggestions from proxy:", error);
        return [];
    }
};

export const generateSellerSuggestions = async (vehicles: Vehicle[], conversations: Conversation[]): Promise<Suggestion[]> => {
    const vehicleSummary = vehicles.map(v => ({
        id: v.id,
        name: `${v.year} ${v.make} ${v.model}`,
        price: v.price,
        mileage: v.mileage,
        descriptionLength: v.description.length,
        imageCount: v.images.length,
        views: v.views || 0,
        inquiries: v.inquiriesCount || 0,
        status: v.status,
    })).filter(v => v.status === 'published');

    const conversationSummary = conversations.map(c => ({
        id: c.id,
        vehicleName: c.vehicleName,
        isReadBySeller: c.isReadBySeller,
        lastMessageTimestamp: c.lastMessageAt,
        lastMessageText: (c.messages && c.messages.length > 0) ? (c.messages[c.messages.length - 1].text ?? '') : '',
        lastMessageSender: (c.messages && c.messages.length > 0) ? (c.messages[c.messages.length - 1].sender ?? 'buyer') : 'buyer',
    })).filter(c => c.lastMessageSender !== 'seller' && !c.isReadBySeller);

    const prompt = `You are an expert AI Sales Assistant for a used vehicle marketplace. Your goal is to provide actionable suggestions to a seller to help them sell their vehicles faster and improve customer communication.
Analyze the following JSON data which contains the seller's current vehicle listings and un-replied customer inquiries.

**Active Vehicle Listings:**
${JSON.stringify(vehicleSummary, null, 2)}

**Un-replied Customer Inquiries:**
${JSON.stringify(conversationSummary, null, 2)}

Based on this data, provide up to 4 high-impact suggestions. Categorize them into 'pricing', 'listing_quality', or 'urgent_inquiry'.
- For pricing suggestions, identify vehicles that might be over or underpriced. A vehicle with high views but very few inquiries could be overpriced. A vehicle with very low views might need a price drop to attract attention.
- For listing quality, suggest improvements. A vehicle with few images (less than 3) or a very short description (less than 50 characters) is a good candidate.
- For urgent inquiries, identify unread messages from customers, especially recent ones or those asking direct questions about price, availability, or test drives, and flag them as high priority.

Respond ONLY with a JSON object containing a "suggestions" key, which is an array of suggestion objects. Each object must have these keys:
- "type": (string) one of 'pricing', 'listing_quality', 'urgent_inquiry'.
- "title": (string) a short, catchy title for the suggestion.
- "description": (string) a one or two-sentence explanation of the suggestion and why it's important.
- "targetId": (string or number) the ID of the vehicle or conversation this suggestion applies to. For vehicles, use the numeric ID. For conversations, use the string ID.
- "priority": (string) one of 'high', 'medium', 'low'.

If there is no data or no meaningful suggestions can be made, return an empty array for "suggestions".`;

    const requestPayload = {
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: SchemaType.OBJECT,
                properties: {
                    suggestions: {
                        type: SchemaType.ARRAY,
                        items: {
                            type: SchemaType.OBJECT,
                            properties: {
                                type: { type: SchemaType.STRING },
                                title: { type: SchemaType.STRING },
                                description: { type: SchemaType.STRING },
                                targetId: { type: SchemaType.STRING }, // Gemini may return number as string
                                priority: { type: SchemaType.STRING },
                            },
                            required: ["type", "title", "description", "targetId", "priority"]
                        }
                    }
                }
            }
        }
    };
    
    try {
        const jsonText = await callGeminiAPI(requestPayload);
        const result = JSON.parse(jsonText.trim());
        
        if (!result.suggestions) {
            return [];
        }

        return result.suggestions.map((s: any) => ({
            ...s,
            targetId: s.type === 'urgent_inquiry' ? String(s.targetId) : Number(s.targetId)
        }));
    } catch (error) {
        // Handle AI API unavailable gracefully (dev mode)
        if (error instanceof Error && error.message === 'AI_API_UNAVAILABLE') {
            // Silently return empty array - AI features disabled in dev
            return [];
        }
        console.warn("⚠️ Error generating seller suggestions (AI may be unavailable):", error instanceof Error ? error.message : error);
        return [];
    }
};

export const getVehicleRecommendations = async (
    activity: { viewed: number[], wishlisted: number[], compared: number[] },
    allVehicles: Pick<Vehicle, 'id' | 'make' | 'model' | 'year' | 'price' | 'features' | 'fuelType'>[]
): Promise<number[]> => {
    const interactedIds = [...new Set([...activity.viewed, ...activity.wishlisted, ...activity.compared])];
    const prompt = `You are a vehicle recommendation engine. A user has shown interest in certain vehicles.
Their activity is summarized below:
- Viewed Vehicle IDs: [${activity.viewed.join(', ')}]
- Wishlisted Vehicle IDs: [${activity.wishlisted.join(', ')}]
- Compared Vehicle IDs: [${activity.compared.join(', ')}]

Here is the full list of available vehicles:
${JSON.stringify(allVehicles, null, 2)}

Analyze the user's activity to understand their preferences (e.g., brand, price range, vehicle type, features).
Based on their preferences, recommend up to 5 vehicle IDs from the full list that they might be interested in.
**Crucially, do not recommend any vehicle IDs that are already in this list of interacted IDs: [${interactedIds.join(', ')}].**

Respond ONLY with a JSON array of recommended vehicle IDs (numbers). For example: [10, 25, 3]. If no suitable recommendations are found, return an empty array.`;

    const requestPayload = {
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: SchemaType.ARRAY,
                items: { type: SchemaType.NUMBER }
            }
        }
    };

    try {
        const jsonText = await callGeminiAPI(requestPayload);
        return JSON.parse(jsonText.trim());
    } catch (error) {
        console.error("Error generating vehicle recommendations from proxy:", error);
        return [];
    }
};

export const getSellerPriceSuggestion = async (
    vehicle: Partial<Pick<Vehicle, 'make' | 'model' | 'year' | 'mileage' | 'features' | 'description'>>,
    marketContext: Pick<Vehicle, 'price' | 'year' | 'mileage'>[]
): Promise<{ summary: string; suggestedMinPrice: number; suggestedMaxPrice: number }> => {
    const prompt = `You are an expert AI vehicle pricing assistant for an Indian marketplace.
Analyze the following vehicle details and market context to provide a price suggestion.

Vehicle Details:
- Make: ${vehicle.make}
- Model: ${vehicle.model}
- Year: ${vehicle.year}
- Mileage: ${vehicle.mileage} kms
- Features: ${vehicle.features?.join(', ') || 'N/A'}
- Description: "${vehicle.description || 'N/A'}"

Market Context (similar vehicles from the same make):
${JSON.stringify(marketContext.slice(0, 10), null, 2)}

Based on the data, provide:
1. A brief summary explaining your pricing rationale. Consider the vehicle's age, mileage, and features compared to the market.
2. A suggested price range (min and max) in INR.

Respond ONLY with a single JSON object matching this schema.
- "summary": A string with your analysis.
- "suggestedMinPrice": A number representing the lower end of the suggested price range.
- "suggestedMaxPrice": A number representing the higher end of the suggested price range.

If there is not enough data to make a suggestion, provide a reason in the summary and set prices to 0.`;
    
    const requestPayload = {
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: SchemaType.OBJECT,
                properties: {
                    summary: { type: SchemaType.STRING },
                    suggestedMinPrice: { type: SchemaType.NUMBER },
                    suggestedMaxPrice: { type: SchemaType.NUMBER },
                },
                required: ['summary', 'suggestedMinPrice', 'suggestedMaxPrice'],
            }
        }
    };

    try {
        const jsonText = await callGeminiAPI(requestPayload);
        const parsed = JSON.parse(jsonText.trim());
        return {
            summary: parsed.summary || "No summary provided.",
            suggestedMinPrice: parsed.suggestedMinPrice || 0,
            suggestedMaxPrice: parsed.suggestedMaxPrice || 0,
        };
    } catch (error) {
        console.error("Error fetching price suggestion from proxy:", error);
        return {
            summary: "Could not connect to the AI pricing service. Please try again later.",
            suggestedMinPrice: 0,
            suggestedMaxPrice: 0,
        };
    }
};