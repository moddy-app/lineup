/** An Application ID as typed: a Discord snowflake, digits only (17 to 20 of them). */
export const isApplicationId = (value: string): boolean => /^\d{17,20}$/.test(value.trim());
