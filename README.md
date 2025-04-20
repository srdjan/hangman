# Hangman Game

A modern, accessible implementation of the classic Hangman word guessing game built with Deno, TypeScript, and HTMX.

![Hangman Game Screenshot](https://via.placeholder.com/800x450.png?text=Hangman+Game+Screenshot)

## Features

- 🎮 Three difficulty levels (Easy, Medium, Hard)
- 🔤 Multiple word categories (General, Animals, Countries)
- 🏆 Game statistics tracking (wins, streaks, time)
- 💡 Hint system to reveal letters when stuck
- 📱 Responsive design for all device sizes
- ⌨️ Full keyboard navigation support
- 👁️ Screen reader compatibility for accessibility
- 🎨 Visual hangman representation using SVG
- 🔄 Session-based gameplay

## Technologies

- **Backend**
  - [Deno](https://deno.land/) - A secure JavaScript/TypeScript runtime
  - TypeScript with strict typing
  - Server-side session management
  - RESTful HTTP endpoints

- **Frontend**
  - HTML with dynamic templating
  - CSS for responsive styling
  - HTMX for AJAX interactions

## Project Structure

```text
hangman/
├── src/                  # Source code
│   ├── data/             # Game data
│   │   └── wordLists.ts  # Word categories and lists
│   ├── routes/           # HTTP route handlers
│   │   ├── handlers.ts   # HTTP request handlers
│   │   └── router.ts     # URL pattern matching and routing
│   ├── state/            # Game state management
│   │   ├── game.ts       # Game logic and state management
│   │   └── session.ts    # User session handling
│   ├── static/           # Static assets
│   │   ├── styles.css    # CSS styling
│   │   └── keyboard.js   # Keyboard navigation and accessibility
│   ├── utils/            # Utility functions
│   │   ├── array.ts      # Array helper functions
│   │   ├── pattern.ts    # Pattern matching utilities
│   │   └── result.ts     # Result type for error handling
│   ├── views/            # HTML templates
│   │   └── home.ts       # HTML template generation
│   ├── main.ts           # Application entry point
│   └── types.ts          # TypeScript type definitions
├── deno.json             # Deno configuration
├── deno.lock             # Dependency lock file
└── README.md             # Project documentation
```

## How to Play

1. **Objective**: Guess the hidden word before the hangman is complete
2. **Gameplay**:
   - Choose a difficulty level (Easy, Medium, Hard)
   - Select a word category (General, Animals, Countries)
   - Click on letters to guess them, or use your keyboard
   - Correct guesses reveal the letter in the word
   - Incorrect guesses add a part to the hangman figure
   - You lose when the hangman is complete (7 incorrect guesses)
   - You win when you reveal the entire word
3. **Hints**:
   - Use the hint button to reveal a random letter
   - Each game allows a limited number of hints
4. **Statistics**:
   - Track your wins, streaks, and game time
   - Try to improve your win rate and best streak

## Getting Started

### Prerequisites

- [Deno](https://deno.land/) (version 1.37.0 or higher)

### Installation & Running

1. Clone the repository

   ```bash
   git clone https://github.com/yourusername/hangman.git
   cd hangman
   ```

2. Run the development server

   ```bash
   deno task dev
   ```

3. Open your browser and visit:
   - <http://localhost:8001>

### Development

The project uses Deno's built-in development server with hot reloading. Any changes you make to the source files will automatically trigger a reload.

#### Adding New Words

To add new words to the game, edit the word lists in `src/data/wordLists.ts`:

```typescript
// Example: Adding new words to the Animals category
export const animalsCategory: WordCategory = {
  name: "Animals",
  words: {
    easy: [
      "CAT", "DOG", "FISH", // existing words...
      "FOX", "RAT", "ANT"   // new words
    ] as const,
    // ...
  }
};
```

## Deployment

### Deno Deploy

This application can be deployed using [Deno Deploy](https://deno.com/deploy), a serverless hosting platform for Deno applications.

#### Deployment Process

1. Create a Deno Deploy account at <https://deno.com/deploy>

2. Install the Deno Deploy CLI (if not already installed)

   ```bash
   deno install -A --no-check -r -f https://deno.land/x/deploy/deployctl.ts
   ```

3. Create a new project in the Deno Deploy dashboard

4. Deploy the application using the deploy task:

   ```bash
   deno task deploy
   ```

5. Alternatively, you can set up GitHub integration for continuous deployment through the Deno Deploy dashboard.

#### Application URL

After deployment, your application will be available at:

- `https://hangman.deno.dev` (or your custom domain)

### Docker Deployment

You can also deploy the application using Docker:

1. Build the Docker image:

   ```bash
   docker build -t hangman-game .
   ```

2. Run the container:

   ```bash
   docker run -p 8001:8001 hangman-game
   ```

3. Access the application at <http://localhost:8001>

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- Word lists compiled from various public domain sources
- Hangman figure design inspired by classic implementations
- Built with ❤️ by [Your Name]
