import validator from "validator";

export type Fields = "firstName" | "lastName" | "phone" | "email";

export const shortenAirlineName = (name: string | undefined) => {
  if (!name) {
    return "";
  }

  const words = name.split(/\s+/); // Split by spaces
  let shortName = "";
  let charCount = 0;

  for (let i = 0; i < words.length; i++) {
    const word = words[i];

    // If it's the first word and longer than 6 chars, return it directly
    if (i === 0 && word.length > 6) {
      return word;
    }

    if (charCount + word.length > 6) {
      if (word.length >= 10) {
        return shortName.trim(); // Stop if the word is very long (10+ chars)
      } else {
        return (shortName + " " + word[0] + ".").trim(); // Add first letter of next word + "."
      }
    }

    shortName += (shortName ? " " : "") + word;
    charCount += word.length;
  }

  return shortName.trim();
};

export const validate: Record<Fields, (value: string) => string> = {
  firstName: (value: string) => {
    const trimmedValue = value.trim();
    if (!trimmedValue) return "שם פרטי הוא שדה חובה";
    if (trimmedValue.length < 2) return "שם פרטי חייב להכיל 2 תווים ויותר";
    if (!/^[A-Za-z\s]+$/.test(trimmedValue)) {
      return "שם פרטי חייב להיות באנגלית בלבד";
    }
    return "";
  },
  lastName: (value: string) => {
    const trimmedValue = value.trim();
    if (!trimmedValue) return "שם משפחה הוא שדה חובה";
    if (trimmedValue.length < 2) return "שם משפחה חייב להכיל 2 תווים ויותר";
    if (!/^[A-Za-z\s]+$/.test(trimmedValue)) {
      return "שם משפחה חייב להיות באנגלית בלבד";
    }
    return "";
  },
  email: (value: string) => {
    const trimmedValue = value.trim();
    if (!trimmedValue) return "אימייל הוא שדה חובה";
    if (!validator.isEmail(trimmedValue)) return "נא להזין כתובת אימייל תקינה";
    return "";
  },
  phone: (value: string) => {
    const cleanPhone = value.replace(/[- ]/g, "");
    if (!cleanPhone) return "טלפון נייד הוא שדה חובה";
    if (!cleanPhone.startsWith("05")) return "מספר נייד חייב להתחיל ב-05";
    if (!validator.isMobilePhone(cleanPhone, "he-IL")) {
      return "נא להזין מספר טלפון תקין";
    }
    return "";
  },
};

/**
 * Check if the price is outside the pack boundries
 * @param totalPrice - Total price for all passengers
 * @param basePrice - Base price per single passenger
 * @param paxs - Number of passengers
 * @returns boolean
 */
export const priceOutsidePackBoundaries = (
  totalPrice: number,
  basePrice: number,
  paxs: number
) => {
  const price = totalPrice / paxs;
  return Math.abs(price - basePrice) >
    Number(process.env.NEXT_PUBLIC_BOUNDRIES || "4")
    ? true
    : false;
};
