// Keyboard navigation for the game
document.addEventListener('DOMContentLoaded', () => {
  // Initialize keyboard navigation
  initKeyboardNavigation();
  
  // Add keyboard event listeners
  document.addEventListener('keydown', handleKeyboardInput);
});

// Initialize keyboard navigation
function initKeyboardNavigation() {
  // Set up mutation observer to handle dynamic content changes
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === 'childList' && mutation.addedNodes.length) {
        setupKeyboardElements();
      }
    }
  });
  
  // Start observing the document body for changes
  observer.observe(document.body, { childList: true, subtree: true });
  
  // Initial setup
  setupKeyboardElements();
}

// Set up keyboard navigation for interactive elements
function setupKeyboardElements() {
  // Set up keyboard buttons
  const keyboardButtons = document.querySelectorAll('.keyboard button');
  keyboardButtons.forEach((button, index) => {
    button.setAttribute('tabindex', '0');
    
    // Add keyboard navigation between buttons
    button.addEventListener('keydown', (e) => {
      const buttons = Array.from(document.querySelectorAll('.keyboard button:not([disabled])'));
      const currentIndex = buttons.indexOf(e.target);
      
      switch (e.key) {
        case 'ArrowRight':
          if (currentIndex < buttons.length - 1) {
            buttons[currentIndex + 1].focus();
          }
          e.preventDefault();
          break;
        case 'ArrowLeft':
          if (currentIndex > 0) {
            buttons[currentIndex - 1].focus();
          }
          e.preventDefault();
          break;
        case 'ArrowUp':
          if (currentIndex >= 7) {
            buttons[currentIndex - 7].focus();
          }
          e.preventDefault();
          break;
        case 'ArrowDown':
          if (currentIndex + 7 < buttons.length) {
            buttons[currentIndex + 7].focus();
          }
          e.preventDefault();
          break;
      }
    });
  });
  
  // Set up difficulty pills
  const difficultyPills = document.querySelectorAll('.difficulty-pill, .category-pill');
  difficultyPills.forEach((pill) => {
    pill.setAttribute('tabindex', '0');
    
    // Add keyboard navigation
    pill.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        pill.click();
      }
    });
  });
  
  // Set up hint button
  const hintButton = document.querySelector('.hint-button');
  if (hintButton && !hintButton.disabled) {
    hintButton.setAttribute('tabindex', '0');
  }
}

// Handle keyboard input for letter guesses
function handleKeyboardInput(e) {
  // Only process if we're not in an input field
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) {
    return;
  }
  
  // Check if the key is a letter A-Z
  if (/^[a-zA-Z]$/.test(e.key)) {
    const letter = e.key.toUpperCase();
    const letterButton = document.querySelector(`button[data-letter="${letter}"]:not([disabled])`);
    
    if (letterButton) {
      letterButton.click();
      e.preventDefault();
    }
  }
}

// Announce game status changes to screen readers
function announceToScreenReader(message) {
  const announcer = document.getElementById('screen-reader-announcer') || createAnnouncer();
  announcer.textContent = message;
}

// Create screen reader announcer element
function createAnnouncer() {
  const announcer = document.createElement('div');
  announcer.id = 'screen-reader-announcer';
  announcer.setAttribute('aria-live', 'assertive');
  announcer.setAttribute('aria-atomic', 'true');
  announcer.classList.add('sr-only');
  document.body.appendChild(announcer);
  return announcer;
}

// Add animation for correct/incorrect guesses
document.addEventListener('htmx:afterSwap', function(event) {
  // Check if this is a letter guess
  if (event.detail.requestConfig.path.startsWith('/guess/')) {
    // Get the letter from the path
    const letter = event.detail.requestConfig.path.split('/').pop();
    
    // Find if the letter is in the word
    const wordDisplay = document.querySelector('.word-display');
    const isCorrect = Array.from(wordDisplay.querySelectorAll('.letter')).some(
      el => el.textContent.trim().toUpperCase() === letter
    );
    
    // Add appropriate animation class
    if (isCorrect) {
      announceToScreenReader(`Correct! The letter ${letter} is in the word.`);
      wordDisplay.classList.add('correct-guess');
      setTimeout(() => wordDisplay.classList.remove('correct-guess'), 1000);
    } else {
      announceToScreenReader(`Incorrect. The letter ${letter} is not in the word.`);
      const hangmanDisplay = document.querySelector('.hangman-display');
      hangmanDisplay.classList.add('incorrect-guess');
      setTimeout(() => hangmanDisplay.classList.remove('incorrect-guess'), 1000);
    }
  }
});
