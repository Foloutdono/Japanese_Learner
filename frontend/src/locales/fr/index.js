import common     from './common'
import auth       from './auth'
import quiz       from './quiz'
import stats      from './stats'
import dictionary from './dictionary'
import decks      from './decks'
import home       from './home'

export default { ...common, ...auth, ...quiz, ...stats, ...dictionary, ...decks, ...home }