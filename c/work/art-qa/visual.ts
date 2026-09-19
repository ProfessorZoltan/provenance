import '../src/ui/styles.css';
import { content, newGame, reduce, skipDialogue } from '../tests/helpers';
import { battleScreen } from '../src/ui/screens/battle';
import { mountBackground } from '../src/art/backgrounds';
let state = skipDialogue(newGame());
state = reduce(state, {type:'START_ENCOUNTER', encounterId:'kell_2312_perimeter', from:'hub'});
if (!state.battle) state = reduce(state, {type:'SCAN_FIGHT'});
while(state.battle?.phase === 'enemy') state = reduce(state, {type:'BATTLE_ENEMY_ACT'});
const root = document.querySelector('#screen')!;
document.documentElement.style.setProperty('--ink', '#f8efd5');
const ctx:any = {content, store:{ dispatch(action:any) {state = reduce(state, action); draw();},lastError(){return null;}},audio:{sfx(){}},toast(){},setPrompts(){},shake(){}};
function draw(){ battleScreen(root as HTMLElement, ctx, state); }
mountBackground(document.querySelector('#bg')!, content.locations.kell_2312, content.eras['2312'], [], true);
draw();


