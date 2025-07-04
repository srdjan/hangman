# Hangman Game Freemium Roadmap

## Current Features

- Basic hangman gameplay
- WebAuthn authentication
- Daily game limits for registered users
- Stats and leaderboard system

## v1.0.0 - Anonymous Mode Release

### Anonymous Mode Features

- [ ] Enable one free game without registration
- [ ] Implement anonymous session tracking
- [ ] Add registration prompt after first game

### Anonymous Mode Development

- [ ] Remove authentication from core game routes
- [ ] Implement game session counter
- [ ] Update route handlers to check anonymous status
- [ ] Add anonymous play tracking in game sessions

## v1.1.0 - User Tiers Implementation

### Subscription Features

- [ ] Implement user subscription model
- [ ] Define tier limits:
  - Anonymous: 1 game per session
  - Free: 5 games per day
  - Premium: Unlimited games

### Subscription Model

- [ ] Add subscription field to user model:

```typescript
interface User {
  subscription: {
    tier: 'free' | 'premium';
    expiresAt?: number;
    stripeCustomerId?: string;
  }
}
```

### Subscription Development

- [ ] Implement subscription-aware game limiting
- [ ] Add premium status verification system

## v1.2.0 - Route Protection & Access Control

### Access Control Features

- [ ] Implement tiered access control
- [ ] Add premium-only features

### Access Control Development

- [ ] Update route protection logic:
  - Core game routes: Allow anonymous (1 game) OR authenticated
  - Stats/leaderboard: Require authentication
  - Unlimited play: Require premium subscription
- [ ] Implement subscription checking middleware

## v2.0.0 - Premium Subscription Launch

### Premium Features

- [ ] Premium subscription ($4.99/month)
- [ ] Subscription management interface
- [ ] Premium user benefits

### Premium Development

- [ ] Integrate Stripe payment system
- [ ] Create subscription management endpoints
- [ ] Implement webhook handlers for Stripe events
- [ ] Add subscription management UI components

## User Flow Implementation

1. Anonymous visitor → Immediate gameplay
2. After first game → Registration prompt for 5 daily games + stats
3. Free user at limit → Premium upgrade prompt
4. Premium user → Unlimited access + all features

## Future Considerations

- Premium-exclusive word lists
- Advanced statistics for premium users
- Team/classroom features
- Custom word list creation
