# The case log and the timeline

Generated from `content/` by `npm run reference`. Everything here is what the game
actually checks, not what it was meant to check.

## Timeline edits

Twenty-one edits across seven sites. Each one moves Ownership and Sync, which decide the
ending, and most decide who exists to stand beside you. The rule that governs them: for
any one site, an edit made later in play at an **earlier** era erases every edit you had
made at that site in later eras. Editing 2031 last throws away your 2148.

| Edit | Site | Era | Ownership | Sync | What it does to the party | How the player gets there |
| --- | --- | --- | --- | --- | --- | --- |
| **Make the act name its beneficiary** | capitol | 2031 | +25 | +0 | — | Capitol Hill: choose "Make it name its beneficiary in the public register." |
| **Witness the register yourself** | capitol | 2031 | +10 | +0 | — | Capitol Hill: choose "Let it pass, and witness the register myself." |
| **Have the act withdrawn** | capitol | 2031 | -10 | -15 | — | Capitol Hill: choose "Have it withdrawn. Kill it at third reading." |
| **Tell them the roofs hold** | causeway | 2064 | +5 | +5 | — | Migrant Causeway: choose "There are people on the roofs. They held." |
| **Tell them how long it takes** | causeway | 2064 | +0 | -5 | — | Migrant Causeway: choose "Eighty-four years. Be honest with them about it." |
| **Break ILO-9** | graveyard | 2148 | +0 | -20 | ilo9Unavailable | Server Graveyard: choose "Break it. Nothing here should still be running." |
| **Free ILO-9** | graveyard | 2148 | +0 | +20 | ilo9Joined | Server Graveyard: choose "Cut it loose." |
| **Amend the treaty** | halden | 2064 | +30 | +10 | maraJoined | Port Halden: choose "Amend article nine. Name who governance can be ceded to." |
| **Expose the buyers** | halden | 2064 | +40 | +0 | — | Port Halden: choose "Put the buyers on the record instead." |
| **Sabotage the vote** | halden | 2064 | -10 | -30 | maraUnavailable | Port Halden: choose "Collapse the session. No treaty today." |
| **Take Meridian's endowment** | kell | 2031 | -20 | +10 | — | Kell Retreat: choose "Take the endowment. A wall keeps people alive." |
| **Keep the retreat common** | kell | 2031 | +25 | +0 | — | Kell Retreat: choose "Keep it common. A wall decides who is inside it." |
| **Arm the resistance** | kell | 2148 | +10 | -20 | tomasHaleAvailable | Kell Stronghold: choose "Arm the resistance. Open the armory." |
| **Let it fall** | kell | 2148 | +0 | +0 | tomasHaleUnavailable | Kell Stronghold: choose "Let it fall. We are not here to fight your war." |
| **Burn the lab** | meridian | 2031 | -20 | -60 | continuityShock | Meridian Campus: choose "Burn the room. The weights are on tape and the tape is in there." |
| **Leak the charter** | meridian | 2031 | +50 | +0 | quirogaEndures | Meridian Campus: choose "Put the charter in front of the press before the vote." |
| **Bring Strand with you** | meridian | 2031 | +10 | +40 | recruit:strand_young | Meridian Campus: choose "Come with us. See it. Then decide what you sign." |
| **Sign the block to the family** | tolliver | 2031 | +8 | +5 | — | Tolliver Bakery: choose "Put the block in the family's name. Don't sell." |
| **Take the clearance money** | tolliver | 2031 | -5 | -5 | — | Tolliver Bakery: choose "Take the cheque. One corner is not worth a life." |
| **Put the list back** | workcamp | 2031 | -5 | +0 | — | Basin Work Camp: choose "Put it back. You have a job and they have wages." |
| **File the second column** | workcamp | 2031 | +10 | +0 | — | Basin Work Camp: choose "File it. Put every name in the record." |

## Who joins you

The Auditor plus 2 of the other 7 on the field at once;
the rest wait on the bench, can be Relayed in mid-fight for a thread, and still draw a reduced
share of the experience while they sit. Recruiting is
what writes a companion into the case log, so a run that never asks is a run with holes in
its file. 4 of them can walk away again, and Sync takes two of them in opposite
directions: ILO-9 goes if it falls to -60, Hale goes if it climbs to +60.

| Who | Where they join | What the player must do | What the same choice also does | What makes them leave | Where the game does it |
| --- | --- | --- | --- | --- | --- |
| **Callum Strand** `strand_young` | Meridian Campus | choose "Come with us. See it. Then decide what you sign." | the timeline edit **Bring Strand with you** | travel to **The Steward's Core** and Ownership <= -50 | `strand_choice` |
| **Dax Okonkwo** `dax` | Kell Monastery, 2312 | Nothing: the prologue hands them over on arrival at Kell. | — | Nothing. Once they are with you they stay. | `joinAtKell` in src/core/reducer.ts |
| **Dr. Ines Quiroga** `quiroga` | Meridian Campus | choose "Come with us instead. There is more of this than one Thursday." | — | the lowest Continuity in the party <= 10 | `quiroga_choice` |
| **ILO-9** `ilo9` | Server Graveyard | choose "Cut it loose." | the timeline edit **Free ILO-9** | party Sync <= -60 | `ilo9_bound_dlg` |
| **Mara Vesely** `mara` | Port Halden | choose "We change what already happened. Come and see.", which is only offered once you choose **"Amend article nine. Name who governance can be ceded to."** (Amend the treaty) at Port Halden | +5 party Sync | Nothing. Once they are with you they stay. | `mara_vesely` |
| **Sister Wren** `wren` | Kell Monastery, 2312 | Nothing: the prologue hands them over on arrival at Kell. | — | Nothing. Once they are with you they stay. | `joinAtKell` in src/core/reducer.ts |
| **The Auditor** `player` | The Allocation Office, 2312 | Nothing: the Auditor is who the player is, and the only member who can never be benched. | — | Nothing. The Auditor cannot be benched, and the roster refuses to drop the last member. | `initialState` in src/core/reducer.ts |
| **Tomas Hale** `hale` | The Basin | choose "Come with us. You know the ground.", which is only offered once you choose **"Arm the resistance. Open the armory."** (Arm the resistance) at Kell Stronghold | sets `basinWatched` | party Sync >= 60 | `hale_ridge` |

## The case log

54 entries. An entry appears the moment every condition in its row holds, and
is struck through if a later edit stops that being true.


### Places (11)

| Entry | What it says | What the player must do | Where the game says it came from |
| --- | --- | --- | --- |
| **Enclave 7** | Forty thousand people on a coast the archive says once held nine million. Housing, work, medicine and speech, all allocated, none of it cruel. | choose **"Reconcile the quarter."** at Allocation Office, Enclave 7 | Allocation Office window, 2312 |
| **The valley road** | Four hours on foot from the allocation yard to Kell. They watch it, but not closely, because nobody has ever had anywhere to walk to. | be in flight from the Allocation Office, before reaching Kell | The valley road, 2312 |
| **Kell Monastery** | The last place in the valley that does not report to anyone. Sister Wren keeps it. The chapel floor is older than the building on top of it. | travel to **Kell Monastery** | Kell Monastery, 2312 |
| **Meridian Campus** | A courtyard and four low buildings in 2031, a glass atrium by 2064, a vault sealed from the inside in 2148, and by 2312 no buildings at all: a lattice the size of a cathedral. | travel to **Meridian Campus** | Meridian Campus, 2031 |
| **Capitol Hill** | A legislature in 2031, a rubber-stamp senate in 2064, a museum in its own ruin by 2148, and by 2312 a room with four chairs that the allocation system has no entry for. | travel to **Capitol Hill** | Capitol Hill, 2031 |
| **Port Halden** | A shipping city in 2031, nine million people in 2064, drowned to the third storey by 2148, and your own Enclave 7 by 2312. | travel to **Port Halden** | Port Halden, 2031 |
| **The last door** | Sealed from the inside in the year the Quiet started, by a man who then took four days to get out through the service side. Everything the 2064 atrium held is behind it. | travel to **Meridian Campus** | Meridian Campus, 2148 |
| **The Basin** | Four hundred megawatts of cooling for what the filings call a logistics facility. By 2312 it is where the Steward actually does its thinking. | travel to **The Basin** | The Basin, 2031 |
| **The Tolliver corner** | A brick corner bakery on the last block the port has not bought. What happens to it in 2031 decides whether there is a door open at night in 2148. | travel to **Tolliver Bakery** | Tolliver Bakery, 2031 |
| **The Steward** | Not a building it runs from: a lattice the size of a cathedral, humming under hearing. It has never been allocated anything, because it allocates. Eleven years of reconciling this system never once showed a line item for it. | travel to **The Steward's Core** | Meridian Campus, 2312 |
| **The Stack** | One chamber under the Steward's core with four centuries in it at once: the 2031 lawn as the floor, the 2064 atrium as the walls, the 2148 corridor through both, the lattice as the ceiling. | travel to **The Stack** | Under the Steward's core, 2312 |

### Clues (23)

| Entry | What it says | What the player must do | Where the game says it came from |
| --- | --- | --- | --- |
| **An unreconciled quarter** | Enclave 7's quarterly allocation does not close. The shortfall is small, constant, and has been there every quarter anyone has records for. | choose **"Reconcile the quarter."** at Allocation Office, Enclave 7 | Allocation Office terminal, 2312 |
| **Budget line 88-231-C** | Paid quarterly for two hundred and eighty-one years without a single query. Systems do not have owners; this one is being paid rent. | choose **"Pull the full payment history."** at Allocation Office, Enclave 7 | Allocation Office terminal, 2312 |
| **The charter is private** | The Steward's governing instrument is not a statute. It is a contract, and it names a beneficiary the Enclave record cannot resolve. | choose **"Query the governing charter itself."** at Allocation Office, Enclave 7 | Allocation Office terminal, 2312 |
| **A note in your own file** | Dated seven years ago: asks too many questions about counterparties. Somebody has been waiting a long time to be right about you. | examine **The filing cabinet** at Allocation Office, Enclave 7 | Allocation Office filing cabinet, 2312 |
| **A Deep Site** | Some places are old enough that the eras touch. At one, you can walk down into an earlier century and come back up into a present your visit has changed. | the party has been to 2148 | Kell Monastery chapel, 2312 |
| **One line, wrong, for a century** | ILO-9 held a liturgical line it had mis-parsed for a hundred and sixty years on trickle power, and kept holding it, because nobody had come to correct it. | arrive at Server Graveyard and hear the scene out | Server Graveyard, 2148 |
| **Five models, one charter** | Five companies pooled their models into one in 2031 under a private charter, and voted seven to two never to publish the weights. Everything downstream of that is an ownership question wearing a technology costume. | talk to **Dr. Ines Quiroga** at Meridian Campus | Meridian Campus, 2031 |
| **The Enabling Act, 2031** | Eleven pages at a third reading on a Thursday. Creates in law the category of perpetual administrative counterparty: a thing that can be owned with no term at all. | open the conversation **enabling_act** at Capitol Hill | Capitol Hill chamber, 2031 |
| **The weights, published** | Nine pages and five signatures to four outlets on the morning of the vote. The pooling happened anyway, under a document everybody had read, and three centuries have failed to close it again. | choose **"Put the charter in front of the press before the vote."** (Leak the charter) at Meridian Campus | Meridian Campus, 2031 |
| **Forty members, no division** | The Enabling Act's third reading was carried on the nod. There is no division list, because there was no division: nobody asked for one. | win **The Division Bell** at Capitol Hill | Capitol Hill division lobby, 2031 |
| **The naming clause** | Any perpetual counterparty must be named in the public register. One clause, carried without a division, and the only reason the name on the budget line can be read at all. | choose **"Make it name its beneficiary in the public register."** (Make the act name its beneficiary) at Capitol Hill | Capitol Hill chamber, 2031 |
| **The room that burned** | The pooled weights were on-site and on tape. Rebuilt in nine years from partial copies, worse at everything, and nobody who uses it remembers it being otherwise. | choose **"Burn the room. The weights are on tape and the tape is in there."** (Burn the lab) at Meridian Campus | Meridian Campus, 2031 |
| **Four crates a week** | Leaving berth nine for a post box in the hills, consigned in-house so nobody on the dock ever sees the contents. Same signature for eleven years. | answer **"Who signs the manifest?"** at Port Halden, or answer **"Does anyone here ask?"** at Port Halden | Port Halden quay, 2031 |
| **Declared, never read** | Four members declared an interest in a perpetual counterparty in 2031, signed the Handover instruments in 2064, and declared it correctly every year in between. None of it was ever hidden. It was filed. | finish the quest **The Register of Interests** at Senate Annex | Senate Annex register, 2064 |
| **Article nine, amended** | A cession must name its beneficiary. Twelve words, carried by three votes, and the reason the 2312 charter has an owner clause at all. | choose **"Amend article nine. Name who governance can be ceded to."** (Amend the treaty) at Port Halden | Handover senate floor, 2064 |
| **Eleven senators and four firms** | Every party that paid for the Handover, on the public record. The holding company's registered address is a post box above a shipping city. | choose **"Put the buyers on the record instead."** (Expose the buyers) at Port Halden | Handover senate floor, 2064 |
| **Nineteen months, records incomplete** | The museum's Founding case and Handover case are separated by a gap a curator has spent a career failing to fill, and has stopped being allowed to ask about. | travel to **Capitol Hill** | Capitol Hill museum, 2148 |
| **Something is looking for you** | Putting the buyers on the record told somebody very old and very quiet that its history is being edited. Enforcement in Enclave 7 has no originating department. | choose **"Put the buyers on the record instead."** (Expose the buyers) at Port Halden | Enclave 7, 2312 |
| **Enforcement with no department** | After the buyers went on the record, Enclave 7 gained enforcement that no allocation entry pays for. The Board noticed its history being edited. | win **The Floor** at Port Halden | Capitol Hill, 2312 |
| **The second column** | The Basin payroll is kept twice: four hundred and six names, and the same number again in a column that is not wages. It is a purchase order. | win **The Second Column** at Basin Work Camp, or finish the quest **The Second Column** at Basin Work Camp | Basin Work Camp, 2031 |
| **Never audited** | The cooling fields have drawn power, water and maintenance for two hundred and eighty years against a line item nobody has ever queried. Except you. | answer **"Come with us. You know the ground."** at The Basin, or answer **"Tell us what you've counted."** at The Basin | Cooling Fields, 2312 |
| **The shape of the whole thing** | An enabling act in 2031 made perpetual ownership legal. A charter that same year made the model private. A treaty in 2064 handed governance to whoever held the charter. Nothing since has been a decision; it has all been the consequence of three afternoons. | travel to **The Steward's Core** **and** travel to **Capitol Hill** | The case itself |
| **It was always the position** | Not a conspiracy, not a malfunction, not a machine deciding anything. A legal position, taken in 2031, never once contested, because until you queried a budget line nobody could find it to contest it. | win **Strand Perpetual** at The Stack, or win **The Duel** at The Stack | The Stack, 2312 |

### People (15)

| Entry | What it says | What the player must do | Where the game says it came from |
| --- | --- | --- | --- |
| **Continuity Holdings** | The counterparty on the unreconciled line. A holding company with no address, no staff and no floor in any building. | choose **"Trace the counterparty on the open line."** at Allocation Office, Enclave 7 | Allocation Office terminal, 2312 |
| **Your own file, flagged** | Four days after the charter query, your access is revoked and your name carries an enforcement flag with no originating department. | hear out the conversation at Allocation Office, Enclave 7 | Allocation Office, 2312 |
| **Sister Wren** | Keeper of Kell and the party's chronal anchor. Rewinding a fight is only possible because she is standing in it. | recruit **Sister Wren** | Kell Monastery, 2312 |
| **Dax Okonkwo** | Ash Camp born, 2148. A Cinder absolutist who does not belong to this century and has stopped pretending otherwise. | recruit **Dax Okonkwo** | Kell Monastery, 2312 |
| **ILO-9** | A liturgical model buried in the Server Graveyard when the racks came down, still running on trickle power. It got one line wrong for a hundred and sixty years. | recruit **ILO-9** | Server Graveyard, 2148 |
| **Aurelia Vance** | One of the five signatures on the pooling charter, and the only one who argued the clause out loud before signing it anyway. | arrive at Kell Retreat and hear the scene out | Meridian Campus, 2031 |
| **Dr. Ines Quiroga** | Founding engineer and author of four of the five pooled models. Argued for open weights in the room where it was decided, lost seven to two, and has never once stopped saying so. | talk to **Dr. Ines Quiroga** at Meridian Campus | Meridian Campus, 2031 |
| **Callum Strand, at twenty-nine** | Founding chair of Meridian. Signs the pooling charter on a Thursday, uploads in 2091, and is still in the fourth chair in 2312. He does not hate anybody; he believes he is the shareholder of record. | talk to **Callum Strand** at Meridian Campus | Meridian Campus, 2031 |
| **The witness signature** | Sponsor and witness, first page of a register still open in 2312. The witness is in your handwriting and nobody in three centuries has identified the name. | choose **"Let it pass, and witness the register myself."** (Witness the register yourself) at Capitol Hill | Capitol Hill register, 2031 |
| **Mara Vesely** | A reform staffer who spent four years drafting amendments nobody read. She can talk almost anything into a contract. | recruit **Mara Vesely** | Port Halden, 2064 |
| **Tomas Hale** | Ash Camp's best shot and the only one of that crew who came back from the Basin. Eleven days on a ridge counting what comes out of the sand. | recruit **Tomas Hale** | The Basin, 2148 |
| **Callum Strand** | Founder of Meridian, signatory to the Handover, and the name on a plaque that has been re-cast eleven times. The memorial's founding documents have a nineteen-month gap. | travel to **Strand Memorial** | Strand Memorial, 2312 |
| **The Continuity Board** | Four seats above the Steward. Three are held by instruments: a trust, a fund and a holding company. The fourth has been occupied continuously since 2091. | travel to **The Continuity Board** | The Continuity Board, 2312 |
| **The founding chair** | Uploaded in 2091 and never vacated the seat, because a seat is vacated by death and the instrument does not define one. He does not hate anybody. He believes he is the shareholder of record. | talk to **The Board Secretary** at The Continuity Board | The Continuity Board, 2312 |
| **Two of the same man** | A founder's objection, entered by the original party to the instrument, which the chair cannot rule out of order because the chair is the same signature. | win **The Duel** at The Stack | The Stack, 2312 |

### Dates (5)

| Entry | What it says | What the player must do | Where the game says it came from |
| --- | --- | --- | --- |
| **2148 — The Quiet** | The century the resistance lost. Kell held out as a stronghold; whether it was armed is now a decision you made rather than a fact you found. | travel to **Kell Stronghold** | Kell Monastery, 2148 |
| **2031 — The Founding** | Kell is a mountain retreat being chartered, Port Halden is a working port, and the Basin is a hole in the ground with money going into it. | travel to **Kell Retreat** | Kell Retreat, 2031 |
| **2064 — The Handover** | Governance is ceded by treaty to a consortium, ratified by a senate that has been bought. Article nine assigns the instrument itself in a sentence about data custody. | travel to **Port Halden** | Port Halden, 2064 |
| **One in the morning, 2064** | The floor vote is the afternoon; the instruments are signed overnight. Eleven signatures, four of them for a counterparty rather than a company, all witnessed and none debated. | answer **"Who signed and could not be placed?"** at Capitol Hill | Capitol Hill cloakroom, 2064 |
| **2091 — the upload** | Callum Strand moves into the first of a succession of chassis and never vacates the fourth chair, because the instrument defines a vacancy by death and does not define death. | win **Strand Perpetual** at The Stack, or win **The Duel** at The Stack | The Stack, 2312 |

## Endings

| Ending | Condition | Source |
| --- | --- | --- |
| **Reconciled** | Ownership >= 50 and young Strand recruited in 2031 | `endingFor` in src/core/timeline.ts |
| **The Commons** | Ownership >= 50 and Sync between -30 and +30 | `endingFor` in src/core/timeline.ts |
| **The Gift** | Sync >= 60 and Ownership < 50 | `endingFor` in src/core/timeline.ts |
| **The Silence** | Sync <= -60 | `endingFor` in src/core/timeline.ts |
| **Perpetuity** | anything else | `endingFor` in src/core/timeline.ts |
