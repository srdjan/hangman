import { WordDifficulty } from "../types.ts";

export interface WordCategory {
  name: string;
  words: Record<WordDifficulty, readonly string[]>;
}

// General category with expanded word lists
export const generalCategory: WordCategory = {
  name: "General",
  words: {
    easy: [
      "CAT", "DOG", "HAT", "PEN", "LAMP", "CHAIR", "BOOK", "DESK", "FISH", 
      "BIRD", "TREE", "BALL", "DOOR", "SHOE", "SOCK", "HAND", "FOOT", "NOSE", 
      "CAKE", "MILK", "STAR", "MOON", "SUN", "RAIN", "SNOW", "WIND", "LEAF"
    ] as const,
    
    medium: [
      "JUNGLE", "MONKEY", "PLANET", "WINDOW", "DINNER", "GARDEN", "FOREST", 
      "CASTLE", "DRAGON", "WIZARD", "KNIGHT", "ISLAND", "MUSEUM", "MARKET", 
      "BRIDGE", "CAMERA", "COFFEE", "GUITAR", "PENCIL", "ROCKET", "SUNSET", 
      "PUZZLE", "MIRROR", "CANDLE", "FLOWER", "TURTLE", "RABBIT"
    ] as const,
    
    hard: [
      "SOPHISTICATED", "TRIUMPHANTLY", "REVOLUTIONARY", "EXTRAORDINARY", 
      "DETERMINATION", "PHILOSOPHICAL", "CONSTELLATION", "ARCHAEOLOGICAL", 
      "BIODIVERSITY", "COLLABORATION", "ENTREPRENEURIAL", "INFRASTRUCTURE", 
      "SUSTAINABILITY", "TECHNOLOGICAL", "UNPREDICTABLE", "VISUALIZATION", 
      "AUTHENTICITY", "COMPREHENSIVE", "ENTHUSIASTIC", "INDEPENDENCE"
    ] as const
  }
};

// Animals category
export const animalsCategory: WordCategory = {
  name: "Animals",
  words: {
    easy: [
      "CAT", "DOG", "FISH", "BIRD", "FROG", "LION", "BEAR", "DUCK", "WOLF", 
      "GOAT", "DEER", "SEAL", "CRAB", "SWAN", "HAWK", "MOLE", "PONY", "TOAD"
    ] as const,
    
    medium: [
      "MONKEY", "TURTLE", "RABBIT", "DOLPHIN", "GIRAFFE", "PENGUIN", "LEOPARD", 
      "BUFFALO", "OCTOPUS", "PANTHER", "RACCOON", "SQUIRREL", "WALRUS", "ZEBRA", 
      "CHEETAH", "HAMSTER", "KOALA", "OSTRICH"
    ] as const,
    
    hard: [
      "CHIMPANZEE", "RHINOCEROS", "HIPPOPOTAMUS", "ORANGUTAN", "CROCODILE", 
      "SALAMANDER", "TARANTULA", "SCORPION", "JELLYFISH", "PORCUPINE", 
      "CHAMELEON", "ARMADILLO", "WOLVERINE", "NARWHAL", "PLATYPUS", "ANTEATER"
    ] as const
  }
};

// Countries category
export const countriesCategory: WordCategory = {
  name: "Countries",
  words: {
    easy: [
      "PERU", "CUBA", "MALI", "FIJI", "CHAD", "TOGO", "OMAN", "LAOS", "IRAQ", 
      "IRAN", "ITALY", "SPAIN", "CHINA", "INDIA", "JAPAN", "CHILE", "EGYPT"
    ] as const,
    
    medium: [
      "CANADA", "MEXICO", "BRAZIL", "FRANCE", "RUSSIA", "TURKEY", "SWEDEN", 
      "NIGERIA", "MOROCCO", "VIETNAM", "THAILAND", "UKRAINE", "DENMARK", 
      "BELGIUM", "AUSTRIA", "CROATIA", "JAMAICA", "IRELAND"
    ] as const,
    
    hard: [
      "AUSTRALIA", "ARGENTINA", "SINGAPORE", "INDONESIA", "PHILIPPINES", 
      "SWITZERLAND", "BANGLADESH", "KAZAKHSTAN", "VENEZUELA", "ZIMBABWE", 
      "MADAGASCAR", "AZERBAIJAN", "UZBEKISTAN", "KYRGYZSTAN", "MONTENEGRO"
    ] as const
  }
};

// All available categories
export const categories: WordCategory[] = [
  generalCategory,
  animalsCategory,
  countriesCategory
];

// Default category is general
export const defaultCategory = generalCategory;

// Get a specific category by name
export const getCategoryByName = (name: string): WordCategory => {
  const category = categories.find(c => c.name.toLowerCase() === name.toLowerCase());
  return category || defaultCategory;
};
