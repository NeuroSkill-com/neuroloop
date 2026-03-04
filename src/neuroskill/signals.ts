/**
 * neuroskill/signals.ts — pure domain-signal detection.
 *
 * `detectSignals` takes a lowercased prompt string and returns a flat boolean
 * map of every domain that was detected. No I/O, no side effects.
 */

/** Returns true when any of the supplied patterns match the string. */
export function any(s: string, ...pats: RegExp[]): boolean {
	return pats.some((p) => p.test(s));
}

/** All detectable domain signals. */
export interface Signals {
	// Core data commands
	sleep: boolean;
	session: boolean;
	compare: boolean;
	sessions: boolean;
	// Lifestyle & productivity
	focus: boolean;
	stress: boolean;
	meditation: boolean;
	mood: boolean;
	// Social & relational
	social: boolean;
	dating: boolean;
	family: boolean;
	loneliness: boolean;
	grief: boolean;
	anger: boolean;
	confidence: boolean;
	// Health & body
	sport: boolean;
	recovery: boolean;
	nutrition: boolean;
	pain: boolean;
	travel: boolean;
	addiction: boolean;
	// Cardiac & somatic
	hrv: boolean;
	somatic: boolean;
	// Mind & growth
	learning: boolean;
	creative: boolean;
	leadership: boolean;
	therapy: boolean;
	goals: boolean;
	performance: boolean;
	// Daily rhythms
	morning: boolean;
	evening: boolean;
	// Inner life & depth
	consciousness: boolean;
	philosophy: boolean;
	existential: boolean;
	depth: boolean;
	morals: boolean;
	symbiosis: boolean;
	awe: boolean;
	identity: boolean;
	// Protocol intent
	protocols: boolean;
}

/**
 * Detect which domains are relevant to the user's prompt.
 * @param lp Lowercased prompt string.
 */
export function detectSignals(lp: string): Signals {
	return {
		// ── Core data commands ──────────────────────────────────────────────

		/** Sleep staging data. */
		sleep: any(
			lp,
			/\bsleep\b|\bslept\b|\bsleeping\b/,
			/\btired\b|\bfatigue[d]?\b|exhausted/,
			/\bnap(ping)?\b|drowsy|yawn|groggy/,
			/woke?\s*up|morning.{0,10}feel|can'?t\s+sleep|sleepy/,
			/nightmare|deep.?sleep|\brem\b|sleep.?quality/,
			/sleep.?cycle|sleep.?pattern|sleep.?stage|sleep.?disorder|sleep.?apnea/,
			/\binsomnia\b|\bnarcolep/,
			/bedtime|snooze|oversleep|under.?slept|night.?rest/,
			/restoration.{0,20}sleep|sleep.{0,20}restoration/,
		),

		/** Detailed session metrics (trends, HRV, stress index, all 50+ fields). */
		session: any(
			lp,
			/\bsession\b|right.?now\b|current.?state|how.?am.?i\b/,
			/my.?focus\b|my.?energy\b|my.?state\b|my.?metrics\b|my.?mood\b|my.?brain\b/,
			/\bEXG\b|biofeedback|brain.?state/,
			/cognitive.?load|engagement.?level|attention.?span/,
			/work.?session|study.?session|focus.?session|meditation.?session/,
			/stress.?level|anxiety.?level|relaxation.?level|mental.?state/,
		),

		/** A/B session comparison and trend deltas. */
		compare: any(
			lp,
			/\bcompare\b|session.?vs|before.?and.?after|a.?vs.?b/,
			/yesterday|previous.?session|last.?session|last.?week|last.?month/,
			/over.?time|\btrend(s)?\b|progress\b|improve(d|ment)?|declin(ed|e)?/,
			/better.?than|worse.?than|tracking\b|weekly\b|monthly\b/,
			/morning.?vs|night.?vs|early.?vs|compare.?session/,
		),

		/** Full session list / history overview. */
		sessions: any(
			lp,
			/\bsessions\b|all.?sessions?|session.?list|session.?history/,
			/recording.?history|how.?many.?sessions?|timeline\b/,
			/when.?did.?i.{0,20}session|past.?sessions?|my.?history\b/,
		),

		// ── Lifestyle & productivity ─────────────────────────────────────────

		/** Focus, deep work, flow state, concentration, productivity. */
		focus: any(
			lp,
			/\bfocus(ed|ing)?\b|deep.?work|flow.?state|in.?the.?zone/,
			/productive?|concentrat(e|ion|ing)|distract(ed|ion)?/,
			/procrastinat|hyperfocus|locked.?in|absorb(ed)?\b/,
			/\btask\b.{0,20}\bwork\b|\bproject\b.{0,20}\bwork\b/,
			/office.?work|coding.?session|writing.?block|reading.?session/,
			/sustained.?attention|attentional?\b|willpower/,
		),

		/** Stress, overwhelm, burnout, pressure. */
		stress: any(
			lp,
			/\bstress(ed|ful|or)?\b|overwhelm(ed|ing)?|\bburnout\b|burnt.?out/,
			/\bpressure\b|\btense(ness)?\b|\bworr(y|ied|ying)\b|\bnervous(ness)?\b/,
			/\bpanic\b|overload(ed)?|frazzled|wound.?up|on.?edge/,
			/fight.?or.?flight|cortisol|adrenali|high.?strung|freak.?out/,
			/deadline.?stress|exam.?stress|work.?pressure|time.?pressure/,
		),

		/** Meditation, mindfulness, breathing, calm, relaxation. */
		meditation: any(
			lp,
			/meditat(e|ing|ion)|mindful(ness)?|contemplat(e|ion)/,
			/\bcalm(ness)?\b|\brelax(ed|ing|ation)?\b|breath(e|ing|work)/,
			/\byoga\b|\bzen\b|peace(ful)?|tranquil|serenity|stillness/,
			/body.?scan|grounded(ness)?|present.?moment|vipassana/,
			/loving.?kindness|mantra|chanting|pranayama|tai.?chi/,
			/transcendental|non.?dual|open.?awareness|choiceless/,
		),

		/** Mood, emotions, affect, valence, general feelings. */
		mood: any(
			lp,
			/\bmood\b|emotional?\s+(state|regulation|wellbeing)|affect\b|valence\b/,
			/\bsad(ness)?\b|\bhapp(y|iness)\b|\bjoy(ful)?\b|\bcontent(ment)?\b/,
			/\bexcited\b|\bhopeless\b|\bhopeful\b|melanchol/,
			/\banger\b|\bangry\b|\bfrustr(at|ation)\b|\birrit(able|ability)\b/,
			/\beuphor(ia|ic)\b|\belat(ed|ion)\b|grateful|gratitude/,
			/feel(ing)?\s+(good|bad|great|terrible|amazing|awful|off|low)/,
			/low.?mood|uplifted|down.?in.{0,5}dumps|feeling.?off|emotionally/,
			/positive.?affect|negative.?affect|emotional.?state|mood.?shift/,
		),

		// ── Social & relational ──────────────────────────────────────────────

		/** Social interactions, conversations, teams, networking. */
		social: any(
			lp,
			/\bsocial(is|ize|ly|izing)?\b|\bnetwork(ing)?\b/,
			/\bconversation\b|\bmeeting\b|\binteract(ion|ing)?\b/,
			/\bcolleague\b|\bcoworker\b|\bteam\b|\bcollaborat/,
			/\bintrovert\b|\bextrovert\b|social.?energy|social.?battery/,
			/social.?anxiety|social.?fatigue|people.?drain|peopled.?out/,
			/\bcrowd\b|\bparty\b|\bgathering\b|\bgroup.?dynamic/,
			/\bfriend(ship|s)?\b.{0,20}(time|meet|hang|feel)/,
			/interpersonal|social.?skill|communication.?style/,
			/peer.?pressure|fitting.?in|belonging|loneliness|isolation/,
		),

		/** Dating, romance, relationships, attraction, intimacy. */
		dating: any(
			lp,
			/\bdat(e|ing)\b|\bromantic(ally)?\b|\bromance\b/,
			/\bpartner\b|\brelationship\b|\bcrush\b|\battraction\b/,
			/\blove\b|\bin.?love\b|first.?date|chemistry\b|\bcouple\b/,
			/\bintimacy\b|\bflirt(ing)?\b|\bheartbreak\b|\bbreakup\b|\bbreak.?up\b/,
			/girlfriend|boyfriend|significant.?other|soulmate|courting/,
			/anxious.{0,20}date|nervous.{0,20}date|date.{0,20}night/,
			/rejection|attachment.?style|love.?language|emotional.?intimacy/,
		),

		/** Family life, parenting, household, caregiving. */
		family: any(
			lp,
			/\bfamily\b|\bfamilies\b|\bhousehold\b|home.?life\b/,
			/\bkids?\b|\bchildren\b|\bchild\b|\bbaby\b|\btoddler\b|\binfant\b/,
			/parent(ing|hood)?|\bmom\b|\bdad\b|\bmother\b|\bfather\b/,
			/\bsibling\b|\bbrother\b|\bsister\b|\bgrandparent\b|\bin.?law\b/,
			/caregiving|caregiver|work.?life.?balance|family.?stress/,
			/fatherhood|motherhood|raising.{0,10}kids?|nurturing\b/,
			/domestic|chores|homework.{0,10}kids?|parental.?burnout/,
		),

		/** Loneliness, isolation, belonging. */
		loneliness: any(
			lp,
			/\blonely\b|\bloneliness\b|\bisolated\b|\bisolation\b/,
			/feel.{0,10}alone\b|\bleft.?out\b|\bexcluded\b|\bbelong\b/,
			/social.?isolation|disconnected\b|withdrawn\b/,
		),

		/** Grief, loss, bereavement. */
		grief: any(
			lp,
			/\bgrief\b|\bgriev(e|ing|ed)\b|\bloss\b|\bbereavement\b/,
			/\bmourning\b|\bmourn(ing)?\b|\bsad.{0,15}loss/,
			/loved.?one.{0,15}(died|passed|death)|death\b.{0,15}(family|friend)/,
		),

		/** Anger, rage, irritability, emotional dysregulation. */
		anger: any(
			lp,
			/\banger\b|\brage\b|\bangry\b|\bfurious\b|\blivid\b/,
			/\birrit(able|ated|ability)\b|\bfrustr(ated|ation)\b/,
			/outburst\b|temper\b|snap(ped|ping)?\b|blow.?up\b/,
			/emotional.?dysregul|reactiv(e|ity)|triggered\b/,
		),

		/** Confidence, self-esteem, imposter syndrome, self-worth. */
		confidence: any(
			lp,
			/\bconfiden(t|ce)\b|\bself.?esteem\b|\bself.?worth\b/,
			/imposter.?syndrome|self.?doubt\b|\binsecure\b|\binsecurity\b/,
			/\bnot.?good.?enough\b|\bfake\b.{0,10}feel|doubt.{0,10}myself/,
			/low.?self.?esteem|self.?efficacy|self.?belief/,
		),

		// ── Health & body ────────────────────────────────────────────────────

		/** Physical exercise, sport, training, fitness, athletics. */
		sport: any(
			lp,
			/\bexercise\b|\bworkout\b|\btraining\b|\bathletic/,
			/\brun(ning|s)?\b|\bgym\b|\bsport\b|\bfitness\b/,
			/\byoga\b|\bswim(ming)?\b|\bcycl(e|ing|ist)\b/,
			/\blifting\b|strength.?train|endurance\b|\bcardio\b|\bhiit\b/,
			/\btennis\b|\bbasketball\b|\bfootball\b|\bsoccer\b|\brugby\b/,
			/martial.?arts|boxing\b|wrestling\b|climbing\b|crossfit/,
			/\bhik(e|ing)\b|trail.?run|outdoor.?sport|athletic.?performance/,
			/pre.?workout|post.?workout|sport.?recovery|physical.?training/,
			/\bvo2max\b|heart.?rate.?zone|lactic.?acid|muscle.?fatigue/,
		),

		/** Recovery, rest days, recharging, downtime, vacations. */
		recovery: any(
			lp,
			/\brecover(y|ing)?\b|\brestoration\b|\brejuvenat\b/,
			/\brecharge\b|\brefresh\b|\breset\b|\bdowntime\b/,
			/rest.?day|day.?off|\bvacation\b|\bholiday\b|\bbreak\b.{0,15}need/,
			/\brecuperat\b|\bwind.?down\b|\bunwind\b|switch.?off/,
		),

		/** Nutrition, eating, caffeine, fasting, food and brain state. */
		nutrition: any(
			lp,
			/\beat(ing|s)?\b|\bmeal\b|\bfood\b|\bnutrition\b|\bdiet\b/,
			/\bcaffeine\b|\bcoffee\b|\btea\b|\bsugar\b|blood.?sugar/,
			/\bfasting\b|\blunch\b|\bdinner\b|\bbreakfast\b|\bsnack\b/,
			/brain.?food|glucose|intermittent.?fast|keto\b|vegan\b/,
			/hydrat|dehydrat|energy.?drink|nootropic|supplement\b/,
		),

		/** Chronic pain, headaches, physical discomfort, body tension. */
		pain: any(
			lp,
			/\bpain\b|\bhurt(ing)?\b|\bdiscomfort\b|\bache\b|\bsore\b/,
			/chronic.?pain|\binflammation\b|body.?tension|muscle.?tension/,
			/back.?pain|neck.?pain|shoulder.?pain|jaw.?tension/,
			/tension.?headache|cluster.?headache|sinus.?pain/,
		),

		/** Travel, jet lag, circadian rhythm disruption. */
		travel: any(
			lp,
			/\btravel(ling|led|er)?\b|\bjet.?lag\b|time.?zone\b|circadian/,
			/long.?flight|international.?travel|travel.?fatigue/,
			/adjust.{0,15}timezone|body.?clock|sleep.{0,15}travel/,
		),

		/** Addiction, cravings, compulsions, substance use. */
		addiction: any(
			lp,
			/\baddiction\b|\baddicted\b|\bcraving(s)?\b|\bcompulsive\b/,
			/\bsubstance\b|\balcohol\b.{0,20}(use|abuse|probl)/,
			/\bsmok(e|ing)\b|\bnicotine\b|\bvaping\b|\bgambling\b/,
			/social.?media.{0,15}addict|doom.?scroll|phone.?addict/,
		),

		// ── Mind & growth ────────────────────────────────────────────────────

		/** Studying, learning, memory, exams, education. */
		learning: any(
			lp,
			/\bstud(y|ying|ied)\b|\blearning\b|\bmemorize?\b/,
			/\bexam\b|\btest\b|\bquiz\b|\bhomework\b|\bassignment\b/,
			/\bclass\b|\bcourse\b|\bschool\b|\buniversit|\bcollege\b|\blecture\b/,
			/\brecall\b|\bretention\b|\bcomprehension\b|\beducation\b/,
			/\btutor(ing)?\b|\bcurriculum\b|\bacademic\b|\bsyllabus\b/,
			/\brevision\b|study.?session|exam.?prep|cram(ming)?/,
			/memory.?palace|spaced.?repetition|active.?recall|flashcard/,
			/reading.{0,20}book|textbook|lecture.?note|study.?note/,
		),

		/** Creative work: art, music, writing, design, ideation. */
		creative: any(
			lp,
			/\bcreat(ive|ivity|ing|or)\b|\barts?\b|\bartistic\b/,
			/\bmusic\b|\bcompos(e|ing|ition)\b|\bimprov(ise|isation)\b/,
			/\bwrit(e|ing|er|ers)\b|\bstorytel(l|ling)\b|\bpoem\b|\bpoetry\b/,
			/\bdesign\b|\bbrainstorm\b|\bimagine\b|\binspir(e|ation)\b/,
			/\bpaint(ing)?\b|\bdraw(ing)?\b|\bsculpt\b|\bsketch\b/,
			/\binvent\b|\binnovat\b|\bideate\b|\bideation\b/,
			/jam.?session|freestyle|creative.?block|makers?\b|\bcraft\b/,
			/creative.?flow|divergent.?thinking|lateral.?thinking/,
		),

		/** Leadership, management, decision-making, strategy. */
		leadership: any(
			lp,
			/\bleadership\b|\bleader\b|\bmanage(r|ment|rial)?\b|\bexecutive\b/,
			/decision.?making|\bstrategic?\b|\bvision(ary)?\b/,
			/\bnegotiat\b|\binfluence\b|\bpersuad\b|\bconflict.?resol/,
			/\bdelegate\b|\bprioritize?\b|\baccountab\b|\borganize?\b/,
			/team.?lead|leading.{0,10}team|leadership.?style|executive.?function/,
			/\bboss\b|\bmanager\b|\bboard\b|\bboardroom\b|c.?suite\b/,
		),

		/** Therapy, counselling, self-reflection, journaling, psychology. */
		therapy: any(
			lp,
			/\btherapy\b|\btherapist\b|\bcounsell?ing\b|\bpsychologist\b/,
			/\bcbt\b|\bdbt\b|\bact\b.{0,20}therapy|psychotherapy/,
			/\bjournal(ing|led)?\b|\bself.?reflect\b|\bintrospect/,
			/mental.?health.{0,15}support|emotional.?support|process.{0,10}feel/,
			/trauma.?therapy|inner.?work|shadow.?work|self.?aware/,
			/emotional.?regulat|coping.?strategy|resilience\b/,
		),

		/** Goals, habits, routines, intention-setting, tracking progress. */
		goals: any(
			lp,
			/\bgoal(s)?\b|\bhabit(s)?\b|\broutine\b|\bintention(s)?\b/,
			/\btrack(ing)?\b.{0,20}progress|progress.{0,20}track/,
			/\bachieve(ment|ments)?\b|\bmilestone\b|\bstreak\b/,
			/behavior.?change|habit.?form|commit(ment)?|self.?discipl/,
			/self.?improvement|personal.?growth|kvr|okr|kpi/,
		),

		/** Public speaking, presentations, performance anxiety. */
		performance: any(
			lp,
			/public.?speak|presentation\b|present.{0,10}(to|for|at)\b/,
			/stage.?fright|performance.?anxiety|\bpitch\b.{0,15}(to|for)/,
			/speak.?in.?front|\baudience\b|\bpresent(ing|ed)\b/,
			/interview.{0,10}(feel|nerv|anxious)|job.?interview/,
			/perform(ance|ing)?.{0,15}(state|anxiety|nerves?)/,
		),

		// ── Daily rhythms ────────────────────────────────────────────────────

		/** Morning routines, waking state, start-of-day. */
		morning: any(
			lp,
			/morning.?routine|wake.?up.?routine|start.?of.{0,5}day/,
			/\bcoffee\b.{0,15}morning|\bbreakfast\b|\bearly.?morning\b|\bdawn\b/,
			/first.?thing.{0,15}morning|beginning.{0,10}day|just.?woke/,
			/am.?routine|morning.?state|morning.?brain|morning.?focus/,
		),

		/** Evening and night routines, end-of-day wind-down. */
		evening: any(
			lp,
			/evening.?routine|wind.?down\b|end.?of.{0,5}day|bedtime.?routine/,
			/night.?time|late.?night|after.?dinner|nightcap\b/,
			/evening.?state|closing.?down|shutting.?off|winding.?down/,
			/pm.?routine|before.?bed|sleep.?prep|tonight.?feel/,
		),

		// ── Cardiac & somatic ───────────────────────────────────────────────────

		/**
		 * HRV / cardiac / autonomic — heart rate, heart rate variability,
		 * palpitations, breathing, chest sensations, autonomic nervous system.
		 */
		hrv: any(
			lp,
			/\bhrv\b|\bheart.?rate.?variab|\brmssd\b|\bsdnn\b|\bpnn50\b/,
			/\bheart\b.{0,20}(rate|beat|palpitat|racing|pounding|flutter|skip|pound)/,
			/\bpalpitation(s)?\b|\bheart.?flutter\b|\bskipped?.?beat\b/,
			/\bbreath(ing)?\b.{0,15}(fast|shallow|heavy|tight|short|racing|rapid)/,
			/\bchest\b.{0,10}(tight|constrict|heavy|flutter|ache|pain|pressure)/,
			/\bautonomic\b|\bvagal\b|\bvagus\b|\bparasympathetic\b|\bsympathetic.?nervous\b/,
			/\bcardiac\b|\bcardiovascular\b|\bheartbeat\b|\bpulse\b.{0,10}(feel|notice|fast|slow)/,
			/racing.{0,10}heart|heart.{0,10}racing|heart.{0,5}(fast|slow|skip|pound)/,
			/\bbreath.?work\b|\bbreathing.?exercise\b|\bwim.?hof\b|\bbox.?breath\b/,
			/\b4.?7.?8\b|\bnasal\b.{0,10}breath|\bdiaphragm(atic)?\b/,
			/lf.?hf|lf.hf.?ratio|heart.?coherence|cardiac.?coherence/,
		),

		/**
		 * Somatic / embodiment — body sensations, physical felt sense,
		 * interoception, embodied awareness, gut feelings, physical tension.
		 */
		somatic: any(
			lp,
			/\bsomatic\b|\bembodiment\b|\bembodied\b|\bbodily\b/,
			/body.?(sensati|aware|feel|scan|tension|wisdom|intelligence)/,
			/feel.{0,10}(in|through|inside|within|throughout).{0,10}body/,
			/\binteroception\b|\bgut.?feeling\b|\bgut.?instinct\b|\bgut.?sense\b/,
			/\btingling\b|\bnumbness\b|\bheaviness\b.{0,15}(body|limb|arm|leg|feeling)/,
			/\btension\b.{0,15}(in.?my|body|muscle|back|neck|shoulder|jaw|held)/,
			/\bstomach\b.{0,10}(knot|tight|flutter|sinking|drop|feeling)/,
			/\bbelly\b.{0,10}(feel|tight|drop|warmth|calm)|\bsolar.?plexus\b/,
			/warm(th)?.{0,10}(inside|chest|heart|belly)|cold.{0,10}(chill|inside|shiver)/,
			/\bgrounded\b.{0,15}body|\bfeel.{0,10}grounded\b|grounding.{0,10}body/,
			/\bsensation(s)?\b.{0,15}(notice|feel|body|physical|present)/,
			/physical.?sensati|felt.?sense\b|body.?mind\b|mind.?body\b/,
		),

		// ── Inner life & depth ───────────────────────────────────────────────

		/**
		 * Consciousness — self-awareness, wakefulness, altered states, presence,
		 * ego dissolution, witness consciousness, lucidity.
		 */
		consciousness: any(
			lp,
			/\bconsciousness\b|\bself.?aware(ness)?\b|\binner.?observer\b/,
			/\bawaken(ed|ing)?\b|\benlighten(ed|ment)?\b|ego.?dissolut/,
			/\bpresence\b.{0,20}(state|moment|feel|awareness)|moment.?to.?moment/,
			/\bwitness\b.{0,15}(self|consciousness|awareness)|pure.?awareness/,
			/\blucid(ity)?\b|lucid.?dream|\baltere[d].?state\b/,
			/\bdissociat(e|ion|ing)\b|\bderealisat|depersonali/,
			/\bwakefulness\b|\blzc\b|lempel.?ziv|consciousness.?metric/,
			/\bnon.?dual(ity)?\b|advaita|not.?the.?thinker|observer.?effect/,
			/stream.?of.?consciousness|altered.?perception|heightened.?awareness/,
		),

		/**
		 * Philosophy — meaning, purpose, ideas, schools of thought,
		 * intellectual inquiry, wisdom, truth-seeking.
		 */
		philosophy: any(
			lp,
			/\bphilosoph(y|ical|er|ise|ize)?\b|\bwisdom\b|\bwisdom.?tradition\b/,
			/\bstoic(ism)?\b|\bepicur(ean|us)?\b|\bplatonist?\b|aristotl/,
			/\bnietzsche\b|\bcamus\b|\bsartre\b|\bheidegger\b|\bkant\b/,
			/\bexistentialis[mt]\b|\bnihilis[mt]\b|\babsurdis[mt]\b/,
			/\bfree.?will\b|\bdeterminis[mt]\b|\bfatalis[mt]\b/,
			/nature.?of.?reality|what.?is.?real|theory.?of.?mind/,
			/\bvirtue\b.{0,20}(ethic|life|moral)|nature.?of.?truth/,
			/\bdialect(ic|al)?\b|\bsocrat(ic|es)\b|\bphilosoph.{0,5}question/,
			/\bontolog(y|ical)\b|\bepistemolog(y|ical)\b|\bphenomenolog/,
			/\bparadox\b|\bthought.?experiment|mind.?body.?problem/,
			/happiness.{0,20}(real|true|mean|philosoph)|philosophy.?of.?life/,
		),

		/**
		 * Existential — mortality, meaning, legacy, impermanence, life's purpose,
		 * the void, finitude, the infinite.
		 */
		existential: any(
			lp,
			/\bmortalit(y|ies)\b|\bdeath\b|\bdie\b|\bdying\b|\bdead\b/,
			/\blegacy\b|\bimperman(ent|ence)\b|\bfinite\b|\binfinity\b/,
			/meaning.?of.?(life|existence)|purpose.?of.?(life|existence)/,
			/why.?(am|are).{0,5}(i|we).{0,10}(here|alive|exist)/,
			/\bwhat.?s.?the.?point\b|point.?of.?(life|all|it|this)/,
			/\bafterlife\b|\breincarnation\b|\bsoul\b.{0,10}(leave|death|die)/,
			/\bexistence\b.{0,20}(precede|mean|matter|anxi)|existential.?crisis/,
			/fear.?of.?death|aware.{0,10}mortal|contemplat.{0,10}death/,
			/\btransience\b|\bephemeral\b|nothing.?lasts|everything.?ends/,
			/\bvoid\b|\bnothingness\b|into.?the.?unknown|facing.?(end|death|nothing)/,
		),

		/**
		 * Depth — profound emotional or intellectual states, going inward,
		 * deep reflection, contemplation, the felt sense of something vast or true.
		 */
		depth: any(
			lp,
			/\bprofound(ly)?\b|\bdeeply?\b.{0,20}(feel|think|move|stir|touch)/,
			/\bcontemplat(e|ing|ion)\b|\bponder(ing)?\b|\bbrood(ing)?\b/,
			/inner.?life|inner.?world|soul.?search|depth.?of.?feel/,
			/\bstir(red)?\b.{0,15}(inside|deeply|soul)|moved.{0,15}deeply/,
			/\btouched\b.{0,15}(deeply|inside|heart|soul)/,
			/depth.?of.?thought|thinking.?deeply|going.?deep|deep.?inside/,
			/feel.{0,10}(something|it).{0,10}(deep|profound|big|vast|huge)/,
			/\bvast(ness)?\b.{0,15}feel|\bsilence\b.{0,15}(inside|within|feel)/,
			/\binward\b|\bwithin\b.{0,10}(look|turn|feel|find|search)/,
		),

		/**
		 * Morals — ethics, values, conscience, right and wrong, integrity,
		 * guilt, shame, moral dilemmas, duty, principles.
		 */
		morals: any(
			lp,
			/\bmoral(s|ity|ly)?\b|\bethic(s|al|ally)?\b|\bvirtue\b/,
			/\bintegrity\b|\bconscience\b|\bprinciple(s)?\b|\bhonesty\b/,
			/\bguilt\b|\bguilt(y|iness)\b|\bshame\b|\bshamed\b|\bregret\b/,
			/right.{0,5}wrong|wrong.{0,5}right|moral.?dilemma|ethical.?dilemma/,
			/\bduty\b|\bobligation\b|\bresponsib(le|ility)\b.{0,15}moral/,
			/did.{0,5}(the.?)?right.?thing|should.{0,5}(have|i)\b/,
			/\bhonour\b|\bhonor\b|\bwrongdoing\b|\bbetrayal\b|\bbetray/,
			/\bkind(ness)?\b.{0,20}(right|moral|ethic|compass)|compassion.{0,15}right/,
			/\bjustice\b|\bfairness\b|\binequality\b.{0,20}feel|treat.{0,10}fairly/,
			/acting.{0,10}(right|wrong|good|badly)|living.{0,10}(value|principle)/,
		),

		/**
		 * Symbiosis — interconnectedness, oneness, unity, interdependence,
		 * nature, collective consciousness, mutual flourishing, harmony.
		 */
		symbiosis: any(
			lp,
			/\bsymbiosis\b|\bsymbiotic\b|\binterconnect(ed|edness|ion)?\b/,
			/\boneness\b|\bunity\b.{0,20}(feel|sense|all|everything|life)/,
			/\binterdependen(t|ce)\b|\bmutual(ism|ly)?\b/,
			/\bharmony\b.{0,20}(with|between|life|nature|all)/,
			/we.?are.?all.?(connected|one|linked|part)|everything.?is.?(connected|one)/,
			/\bnature\b.{0,20}(connected|harmony|part.?of|belong|oneness)/,
			/\bcollective\b.{0,20}(consciousness|wellbeing|good|mind)/,
			/part.?of.?(something.?bigger|the.?whole|nature|all|universe)/,
			/\becosystem\b|\bco.?exist(ence)?\b|\bcooperat\b.{0,20}life/,
			/relationship.{0,20}(with.?nature|all.?things|universe|world)/,
			/\bbelonging\b.{0,20}(universe|all|nature|life|cosmos)/,
		),

		/**
		 * Awe — wonder, transcendence, peak experiences, the sublime,
		 * sacred, cosmic, oceanic feeling, being overwhelmed by beauty or vastness.
		 */
		awe: any(
			lp,
			/\bawe\b|\bawe.?(struck|some|inspiring)?\b|\bwonder\b.{0,15}(feel|sense|fill)/,
			/\btranscenden(t|ce|tal)\b|\bsublime\b|\bsacred\b|\bholy\b.{0,15}feel/,
			/\bpeak.?experience\b|\bocean.?feeling\b|\bmystic(al)?\b/,
			/overwhelmed.{0,15}(beauty|vastness|universe|cosmos|nature)/,
			/\bmagical\b.{0,10}(feel|moment|experience|sense)|magic.{0,10}in.{0,10}(life|world)/,
			/\bcosmic\b|\buniverse\b.{0,20}(feel|connected|sense|part)/,
			/\bmajestic\b|\bbeauty\b.{0,15}(overwhelm|move|stir|profound)/,
			/sense.?of.?(wonder|awe|mystery|vastness|presence)|feeling.?of.?(awe|wonder)/,
			/\bspiritual(ity)?\b.{0,15}(feel|sense|experience|state)|felt.{0,10}spiritual/,
			/\bgratitude\b.{0,20}(all|universe|life|exist|cosmos)/,
		),

		/**
		 * Identity — self-concept, authenticity, self-discovery, persona,
		 * who am I, values-alignment, being true to oneself.
		 */
		identity: any(
			lp,
			/\bidentity\b|\bself.?concept\b|\bself.?image\b|\bself.?discovery\b/,
			/who.{0,5}am.{0,5}i\b|who.{0,5}i.{0,5}(am|really|truly|actually)/,
			/\bauthentic(ity|ally)?\b|\btrue.?self\b|\breal.?self\b/,
			/be(ing)?.{0,10}(myself|yourself|oneself)|true.{0,10}(to.?myself|to.?oneself)/,
			/\bmask\b.{0,15}(wear|take.?off|behind)|taking.?off.{0,10}mask/,
			/\bpersona\b|\brole\b.{0,20}(play|wear|society|world)/,
			/sense.?of.?self|self.?expression\b|self.?concept\b/,
			/finding.{0,10}(myself|yourself|purpose|meaning.{0,10}(self|who))/,
			/values.{0,15}(align|match|live|compass|true)|living.{0,10}my.?values/,
			/\bcharacter\b.{0,15}(build|grow|true|who|define)|defining.{0,10}(who|myself)/,
		),

		/**
		 * Protocol intent — user is asking for a guided practice, exercise, or routine,
		 * or describes a context where a structured protocol is likely to be helpful.
		 * Triggers loading of the full protocol repertoire skill.
		 */
		protocols: any(
			lp,
			// Explicit guided-practice requests
			/\bprotocol\b|\bguided?\s+(exercise|practice|session|meditat|breath)/,
			/guide\s+(me|us)\s+(through|into|with)|walk\s+me\s+through/,
			/can\s+we\s+do\s+(a\s+)?(quick\s+)?(breath|relax|meditat|exercise|stretch|protocol)/,
			/help\s+me\s+(relax|calm\s+down|breathe|focus|sleep|unwind|de.?stress|reset)/,
			/\bneed\s+(to\s+)?(relax|calm|unwind|de.?stress|reset|breathe)\b/,
			// Breathing & breath-work
			/breath(e|ing)\s+(exercise|work|practice|with\s+me|together)/,
			/\bbox\s+breath|\b4.?7.?8\b|\bwim\s+hof\b|\bkapalabhati\b|\bnadi\s+shodhana\b/,
			/\bcardiac\s+coherence\b|\bcoherent\s+breath|\bphysiological\s+sigh\b/,
			// Meditation & mindfulness practices
			/\bbody\s+scan\b|\bprogressive\s+muscle\b|\bpmr\b|\bnsdr\b|\byoga\s+nidra\b/,
			/\bloving.?kindness\b|\bmetta\b|\bmantra\s+meditat|\bopen\s+monitor/,
			/\bgrounding\s+exercise|\b5.?4.?3.?2.?1\b|\bsomatic\s+(exercise|practice|shake)/,
			/\bauogenic\s+train|\bhavening\b|\btre\b.{0,15}(exercise|tension|release)/,
			// Body & movement practices
			/\bneck\s+(exercise|stretch|pain|tension|stiff|sore|release|relief)/,
			/\beye\s+(exercise|strain|tired|fatigue|relief|stretch|rest)/,
			/\bshoulder\s+(exercise|stretch|roll|release|tension|pain|relief)/,
			/\bdesk\s+yoga|\bmotor\s+cortex|\bmind.?muscle\b/,
			/\bwarm.?up\b|\bcool.?down\b|\bstretch(ing)?\s+(routine|session|now)/,
			/\bpre.?workout\s+(routine|protocol|prep)|\bpost.?workout\s+(routine|recovery)/,
			// Morning & evening routines
			/morning\s+(routine|exercise|stretch|activation|ritual|practice|protocol)/,
			/evening\s+(routine|wind.?down|ritual|practice|protocol)/,
			/\bsleep\s+(routine|ritual|protocol|prep|practice)\b/,
			// Eye & vision
			/\b20.?20.?20\b|\bpalming\s+(exercise|practice)|\beye\s+roll/,
			// Workout & gym
			/before\s+(the\s+)?(gym|workout|training|run|lifting)/,
			/after\s+(the\s+)?(gym|workout|training|run|lifting)/,
			/\bintra.?workout|\bbetween\s+sets?\b/,
			// Hydration & breaks
			/\bwater\s+break\b|\bdrink\s+(some\s+)?water|\bhydrat(e|ion)\s+(reminder|break)/,
			/\bbathroom\s+break\b|\bmovement\s+(break|snack)\b|\btake\s+a\s+break\b/,
			// Music as therapy
			/music\s+(for|to\s+help|therapy|that\s+will|to\s+focus|to\s+relax|to\s+sleep|to\s+calm)/,
			/\bplaylist\s+(for|to|that)\b|\bbinaural\s+beat|\bsound\s+therapy\b/,
			/\bsinging\s+(for|to\s+help)|humming\s+(exercise|practice|for)/,
			// Social media & digital wellness
			/tiktok.{0,20}(addict|too\s+much|help|control|stop|problem)/,
			/instagram.{0,20}(addict|too\s+much|help|control|stop|scroll|problem)/,
			/doom.?scroll|can.{0,10}stop\s+(scroll|check|open)|phone\s+addict/,
			/social\s+media\s+(addict|too\s+much|detox|problem|help|control)/,
			/\bdigital\s+(detox|sunset|wellness|addiction)\b|\bscreen\s+time\b.{0,20}(too\s+much|help|problem)/,
			// Dietary & nutrition guidance
			/what\s+(should|can)\s+i\s+eat|what\s+to\s+eat\b/,
			/\bmindful\s+eat|\beat(ing)?\s+(slowly|mindfully|habits?|better|healthier)/,
			/\bfasting\s+(tips?|help|support|protocol|guide)\b/,
			/caffeine\s+(timing|when|cut.?off|too\s+much|advice)/,
			/\bintermittent\s+fast|\bif\s+protocol\b/,
			// Emotional processing with explicit request
			/help\s+(me\s+)?(process|work\s+through|deal\s+with)\s+(this|anger|grief|stress|anxiety|emotion)/,
			/how\s+(do|can)\s+i\s+(deal|cope|handle|manage)\s+with\s+(this|anger|grief|stress|anxiety)/,
			// Generic intervention requests
			/something\s+(helpful|calming|relaxing|energising|to\s+help\s+with)/,
			/\bshow\s+me\s+(a|an|the|some)\s+(exercise|practice|technique|protocol|routine)/,
			/\bdo\s+(a|an)\s+(breathing|relaxation|meditation|grounding|stretching)\b/,
		),
	};
}
