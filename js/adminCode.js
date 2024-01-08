 // What grid are we goofin around with?
let gridId = 0;

// Var score is calculating ?
let scoringOngoing = false;

function liveSearch(inputElement, answers) {
    if (inputElement.value.length > 2) {
        console.log('Requesting search for '+inputElement.value);
        searchSpotify(inputElement.value)
            .then(songs => displaySpotifyResults(songs, inputElement, answers))
            .catch(error => console.error('Error fetching Spotify data:', error));
    } else {
        removeDropdown(inputElement);
    }
}

async function searchAnswers(answerTerms) {
    console.log('Initializing evaluation of answers ' + answerTerms);
    let promises = answerTerms.map(answerTerm => searchSpotify(answerTerm));

    // Wait for all promises to resolve
    let results = await Promise.all(promises);
    
    // Process the results to extract popularity values
    let answerPopsArr = results.map(result => {
        // Assuming the result structure includes an array of songs
        if (result.length > 0 && result[0].popularity !== undefined) {
            return result[0].popularity; // Take the popularity of the first song as an example
        }
        return null; // Handle cases where no songs are found or structure is different
    });

    console.log('Answer Pops Array now at: ', answerPopsArr.toString());
    return answerPopsArr;
}

async function searchSpotify(searchTerm) {
    console.log('Searching for '+searchTerm)
    const response = await fetch('https://music-grid-io-42616e204fd3.herokuapp.com/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ searchTerm })
    });
    console.log('Received response: '+response)
    if (!response.ok) throw new Error('Failed to fetch');
    return response.json();
}

function extractCorrectAnswers(oninputValue) {
    // Assuming the format is liveSearch(this, ['Answer1', 'Answer2', ...])
    const answersMatch = oninputValue.match(/\[\s*'(.*?)'\s*\]/);
    return answersMatch ? answersMatch[1].split("', '") : [];
}

// Call this function when the page loads to display the leaderboard
window.onload = function() {
    initializeSite();
};

function initializeSite() {
    console.log('Initializing Site');
    console.log('Loading grid');
    loadGridData();
}

// Add submitted game + username to leaderboard, let's not worry about sanitizing for now as there's not much to hack
function loadGrid() {
    fetch('https://music-grid-io-42616e204fd3.herokuapp.com/fetch-grid-summary')
        .then(response => response.json())
        .then(data => {
            console.log('Grid data summary dump fetched');
            displayGridsSumm(data);
        })
        .catch(error => console.error('Error fetching live grid id:', error));
};



function displayGridsSumm(data) {
    const gridContainer = document.getElementById('data-dump');
    gridContainer.innerHTML = ''; // Clear existing content
  
    data.forEach(item => {
        //Create summary row for each
        console.log('Creating summary row for id: '+item.grid_id);
        const summRow = document.createElement('div');
        summRow.classList.add('row');
        summRow.appendChild(createCell('summCell',item.grid_id));
        summRow.appendChild(createCell('summCell',item.create_date));
        summRow.appendChild(createCell('summCell',item.post_date));
        summRow.appendChild(createCell('summCell',item.answers_last_updated_pst));
        summRow.appendChild(createCell('summCell',item.num_artist_cells));
        summRow.appendChild(createCell('summCell',item.num_category_cells));
        summRow.appendChild(createCell('summCell',item.num_raw_answer_cells));
        summRow.appendChild(createCell('summCell',item.num_encoded_answer));
        summRow.appendChild(createCell('summCell',item.num_fields_w_encoded_answers));
        summRow.appendChild(createLoadCell('loadCell',item.grid_id));
        gridContainer.appendChild(summRow);
    }
}

function createCell(className, text = '') {
    const cell = document.createElement('div');
    cell.classList.add('cell', className);
    cell.textContent = text;
    return cell;
}

function createLoadCell(className, text = '') {
    const cell = document.createElement('div');
    cell.classList.add('cell', 'song-cell');
    const button = document.createElement('input');
    button.type = 'button';
    button.setAttribute('value', `Load grid id `+text);
    button.setAttribute('onclick', 'loadGrid('+text+')');
    cell.appendChild(button);
    return cell;
}

function createSongCell(answers) {
    const cell = document.createElement('div');
    cell.classList.add('cell', 'song-cell');
    const input = document.createElement('input');
    input.type = 'text';
    input.setAttribute('oninput', `liveSearch(this, ${JSON.stringify(answers)})`);
    input.setAttribute('placeholder', 'Type to search...');
    cell.appendChild(input);
    return cell;
}


// Add submitted game + username to leaderboard, let's not worry about sanitizing for now as there's not much to hack
function leaderboardUpdate(playerName, score) {
    fetch('https://music-grid-io-42616e204fd3.herokuapp.com/submit-score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: playerName, score: score, lb_id: gridId })
    })
    .then(response => response.json())
    .then(data => {
        console.log(data.message);
        loadLeaderboard(); // Refresh the leaderboard after updating
    })
    .catch(error => console.error('Error:', error));
}

// TODO: Display leaderboard from CSV on first pageload
    // Add give up button
    
function removeDropdown(inputElement) {
    if (inputElement && inputElement.parentNode) {
        const existingContainer = inputElement.parentNode.querySelector('.results-dropdown');
        if (existingContainer) {
            inputElement.parentNode.removeChild(existingContainer);
        }
    } else {
        console.error('Input element is not in the DOM or has no parent.');
    }
}


// Function to update the score based on the user's guess
async function updateScoreForGuess(popularity, answers, cell, songInfo) {
    scoringOngoing = true;
    updateScoreTo('(updating score)');
    calculateAnswerPops(answers);
    var cellScoreMax = 0;
    var cellScoreMin = 0;
    var normedGuessScore = 0;
    var popInt = parseInt(popularity);
    console.log('Norming score off popularity of '+popInt+' from string '+popularity);
    let answerPops = await calculateAnswerPops(answers);
    console.log('Popularities returned to score updater for: '+answers.toString());
    console.log('Returned popularities: '+answerPops.toString());
    cellScoreMax = Math.max.apply(Math, answerPops);
    console.log('Max cell popularity determined as: '+cellScoreMax);
    cellScoreMin = Math.min.apply(Math, answerPops);
    console.log('Min cell popularity determined as: '+cellScoreMin);
    if (cellScoreMin == cellScoreMax) {
        normedGuessScore = 11;
    } else {
        normedGuessScore = 6+5*Math.round(10*(1 - ((popInt - cellScoreMin)/(cellScoreMax - cellScoreMin))))/10;
    }
    
    // Updating score in Song Cell
    cell.style.backgroundColor = '#c8e6c9'; // Green for correct
    cell.textContent = 'Correct: ' + songInfo + ' ('+normedGuessScore+' out of 11 points scored)';

    // Calculating total score
    console.log('Normed score determined as: '+normedGuessScore);
    console.log('Adding normed score to prior total of '+totalScore);
    totalScore+=normedGuessScore;
    console.log('Displaying new total score of '+normedGuessScore);
    updateScoreTo(totalScore);
}

async function calculateAnswerPops(answers) {
    console.log('Parsing answer popularities');
    let answerPops = await searchAnswers(answers);
    console.log('Returned popularities: ', answerPops.toString());

    // Filter out null values if any song wasn't found or popularity was missing
    answerPops = answerPops.filter(pop => pop !== null);

    console.log('Filtered answer popularities: ', answerPops.toString());
    return answerPops;
}

function updateScoreTo(totalScore) {
    scoreReadable = ' '+totalScore
    document.getElementById("totalScore").textContent=scoreReadable;
    scoringOngoing = false;
    // Check if game is now complete
    if (correctGuesses == 9 && !(totalScore.equals('(updating score)'))) {
        terminateGame();
    }
}
