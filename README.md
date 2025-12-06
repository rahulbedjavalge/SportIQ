# SportIQ – Your AI Sports Companion

SportIQ is an intelligent sports chatbot built with Next.js, TensorFlow.js, and SQLite. It uses a trained NLP model to understand user intents and provide relevant sports information from a local database. The app features a clean chat interface and can polish sports-related text using AI.

## Features

- **Chat Interface**: Simple, responsive UI for interacting with the bot
- **Intent Recognition**: NLP model classifies user queries into 10 sports-related intents
- **Database Queries**: Retrieves sports data from a local SQLite database
- **Text Polishing**: Uses AI to rephrase sports text for better engagement (always enabled)
- **Example Questions**: Click the "Questions" button to view and select from example queries in a grid
- **Offline Training**: Trains the NLP model locally with reproducible results
- **Deployable**: Ready for deployment on Vercel or other platforms

## Live Project

Check out the live version of SportIQ: [SportIQ Live](https://sport-iq-pi.vercel.app)

## Installation and Setup

1. **Clone the repository**:
   ```bash
   git clone https://github.com/rahulbedjavalge/SportIQ.git
   cd SportIQ
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Set up environment variables**:
   Create a `.env.local` file in the root directory:
   ```
   API_KEY=your_api_key_here
   ```

4. **Train the NLP model** (optional, model is pre-trained):
   ```bash
   npm run train:intents
   ```

5. **Run the development server**:
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) in your browser.

6. **Build for production**:
   ```bash
   npm run build
   npm start
   ```

## NLP Model Training

The NLP model is a simple feedforward neural network trained on intent classification for sports queries.

### Data
- **Dataset**: 33 labeled examples across 10 intents
- **Vocabulary**: 63 unique words
- **Intents**: today_fixtures, latest_score, goal_scorers, stadium_location, sport_type_for_match, upcoming_for_team, last_match_for_team, top_scorer_team, tournament_info, help

### Model Architecture
- **Input**: Bag-of-words vector (normalized L2)
- **Layers**:
  - Dense (32 units, ReLU activation)
  - Dropout (20% rate)
  - Dense (10 units, Softmax activation)
- **Parameters**: 2,378 trainable
- **Optimizer**: Adam (learning rate 0.01)
- **Loss**: Categorical Crossentropy

### Training Process
1. **Preprocessing**: Tokenization, vocabulary building, vectorization
2. **Split**: Stratified 80/20 train/validation split (deterministic seed)
3. **Training**: 25 epochs, batch size 8
4. **Evaluation**: Accuracy, precision, recall, F1-score per intent

### Metrics
- **Final Validation Accuracy**: 60.00%
- **Macro F1-Score**: 0.54
- **Per-Intent Performance** (sorted by F1):
  - sport_type_for_match: F1 1.00 (support 1)
  - stadium_location: F1 1.00 (support 1)
  - today_fixtures: F1 1.00 (support 1)
  - upcoming_for_team: F1 0.67 (support 3)
  - goal_scorers: F1 0.50 (support 4)
  - latest_score: F1 0.50 (support 4)
  - last_match_for_team: F1 0.40 (support 3)
  - top_scorer_team: F1 0.33 (support 3)
  - tournament_info: F1 0.00 (support 3)
  - help: F1 0.00 (support 1)

The model performs well on intents with more training examples but struggles with underrepresented intents.

## Example Questions

Here are example questions you can ask SportIQ (also available via the "Questions" button in the UI):

1. "who is playing today" (today_fixtures)
2. "score berlin united" (latest_score)
3. "result for munich city" (latest_score)
4. "who scored for berlin united" (goal_scorers)
5. "which stadium was it played" (stadium_location)
6. "what sport is this match" (sport_type_for_match)
7. "next match berlin united" (upcoming_for_team)
8. "tournament info" (tournament_info)

## API Endpoints

- `GET /`: Main chat interface
- `POST /api/polish`: Polishes sports-related text using AI

## Deployment

### Vercel
1. Push your code to GitHub
2. Go to [Vercel](https://vercel.com) and import your repository
3. Add environment variables in Vercel dashboard
4. Deploy!

### Other Platforms
The app can be deployed to any platform supporting Node.js, such as Netlify, Heroku, or AWS.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests and build
5. Submit a pull request

## License

This project is open source. Feel free to use and modify it.
