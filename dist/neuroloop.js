#!/usr/bin/env node

// src/main.ts
import { existsSync as existsSync4, readdirSync, readFileSync as readFileSync4 } from "node:fs";
import { homedir as homedir3 } from "node:os";
import { basename, dirname as dirname4, join as join4, relative } from "node:path";
import { fileURLToPath as fileURLToPath3 } from "node:url";
import {
  AuthStorage,
  createAgentSession,
  DefaultResourceLoader,
  InteractiveMode,
  ModelRegistry,
  SessionManager,
  SettingsManager
} from "@mariozechner/pi-coding-agent";

// src/neuroloop.ts
import { existsSync as existsSync3, readFileSync as readFileSync3, writeFileSync as writeFileSync2 } from "node:fs";
import { homedir as homedir2 } from "node:os";
import { dirname as dirname3, join as join3 } from "node:path";
import { exec } from "node:child_process";
import { fileURLToPath as fileURLToPath2 } from "node:url";
import { Container, Markdown, Spacer } from "@mariozechner/pi-tui";
import { truncateToWidth, visibleWidth } from "@mariozechner/pi-tui";
import { Type as Type4 } from "@sinclair/typebox";
import { getMarkdownTheme } from "@mariozechner/pi-coding-agent";
import WS from "ws";

// src/neuroskill/run.ts
import { execFile } from "node:child_process";
import { promisify } from "node:util";
var execFileAsync = promisify(execFile);
var NEUROSKILL_TIMEOUT_MS = 1e4;
async function runNeuroSkill(args) {
  try {
    const { stdout } = await execFileAsync("npx", ["neuroskill", ...args], {
      timeout: NEUROSKILL_TIMEOUT_MS,
      env: { ...process.env }
    });
    const text = stdout.trim();
    if (!text) return { ok: false, error: "empty response" };
    try {
      const data = JSON.parse(text);
      return { ok: true, data, text };
    } catch {
      return { ok: true, text };
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: msg };
  }
}

// src/neuroskill/signals.ts
function any(s, ...pats) {
  return pats.some((p) => p.test(s));
}
function detectSignals(lp) {
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
      /restoration.{0,20}sleep|sleep.{0,20}restoration/
    ),
    /** Detailed session metrics (trends, HRV, stress index, all 50+ fields). */
    session: any(
      lp,
      /\bsession\b|right.?now\b|current.?state|how.?am.?i\b/,
      /my.?focus\b|my.?energy\b|my.?state\b|my.?metrics\b|my.?mood\b|my.?brain\b/,
      /\bEXG\b|biofeedback|brain.?state/,
      /cognitive.?load|engagement.?level|attention.?span/,
      /work.?session|study.?session|focus.?session|meditation.?session/,
      /stress.?level|anxiety.?level|relaxation.?level|mental.?state/
    ),
    /** A/B session comparison and trend deltas. */
    compare: any(
      lp,
      /\bcompare\b|session.?vs|before.?and.?after|a.?vs.?b/,
      /yesterday|previous.?session|last.?session|last.?week|last.?month/,
      /over.?time|\btrend(s)?\b|progress\b|improve(d|ment)?|declin(ed|e)?/,
      /better.?than|worse.?than|tracking\b|weekly\b|monthly\b/,
      /morning.?vs|night.?vs|early.?vs|compare.?session/
    ),
    /** Full session list / history overview. */
    sessions: any(
      lp,
      /\bsessions\b|all.?sessions?|session.?list|session.?history/,
      /recording.?history|how.?many.?sessions?|timeline\b/,
      /when.?did.?i.{0,20}session|past.?sessions?|my.?history\b/
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
      /sustained.?attention|attentional?\b|willpower/
    ),
    /** Stress, overwhelm, burnout, pressure. */
    stress: any(
      lp,
      /\bstress(ed|ful|or)?\b|overwhelm(ed|ing)?|\bburnout\b|burnt.?out/,
      /\bpressure\b|\btense(ness)?\b|\bworr(y|ied|ying)\b|\bnervous(ness)?\b/,
      /\bpanic\b|overload(ed)?|frazzled|wound.?up|on.?edge/,
      /fight.?or.?flight|cortisol|adrenali|high.?strung|freak.?out/,
      /deadline.?stress|exam.?stress|work.?pressure|time.?pressure/
    ),
    /** Meditation, mindfulness, breathing, calm, relaxation. */
    meditation: any(
      lp,
      /meditat(e|ing|ion)|mindful(ness)?|contemplat(e|ion)/,
      /\bcalm(ness)?\b|\brelax(ed|ing|ation)?\b|breath(e|ing|work)/,
      /\byoga\b|\bzen\b|peace(ful)?|tranquil|serenity|stillness/,
      /body.?scan|grounded(ness)?|present.?moment|vipassana/,
      /loving.?kindness|mantra|chanting|pranayama|tai.?chi/,
      /transcendental|non.?dual|open.?awareness|choiceless/
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
      /positive.?affect|negative.?affect|emotional.?state|mood.?shift/
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
      /peer.?pressure|fitting.?in|belonging|loneliness|isolation/
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
      /rejection|attachment.?style|love.?language|emotional.?intimacy/
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
      /domestic|chores|homework.{0,10}kids?|parental.?burnout/
    ),
    /** Loneliness, isolation, belonging. */
    loneliness: any(
      lp,
      /\blonely\b|\bloneliness\b|\bisolated\b|\bisolation\b/,
      /feel.{0,10}alone\b|\bleft.?out\b|\bexcluded\b|\bbelong\b/,
      /social.?isolation|disconnected\b|withdrawn\b/
    ),
    /** Grief, loss, bereavement. */
    grief: any(
      lp,
      /\bgrief\b|\bgriev(e|ing|ed)\b|\bloss\b|\bbereavement\b/,
      /\bmourning\b|\bmourn(ing)?\b|\bsad.{0,15}loss/,
      /loved.?one.{0,15}(died|passed|death)|death\b.{0,15}(family|friend)/
    ),
    /** Anger, rage, irritability, emotional dysregulation. */
    anger: any(
      lp,
      /\banger\b|\brage\b|\bangry\b|\bfurious\b|\blivid\b/,
      /\birrit(able|ated|ability)\b|\bfrustr(ated|ation)\b/,
      /outburst\b|temper\b|snap(ped|ping)?\b|blow.?up\b/,
      /emotional.?dysregul|reactiv(e|ity)|triggered\b/
    ),
    /** Confidence, self-esteem, imposter syndrome, self-worth. */
    confidence: any(
      lp,
      /\bconfiden(t|ce)\b|\bself.?esteem\b|\bself.?worth\b/,
      /imposter.?syndrome|self.?doubt\b|\binsecure\b|\binsecurity\b/,
      /\bnot.?good.?enough\b|\bfake\b.{0,10}feel|doubt.{0,10}myself/,
      /low.?self.?esteem|self.?efficacy|self.?belief/
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
      /\bvo2max\b|heart.?rate.?zone|lactic.?acid|muscle.?fatigue/
    ),
    /** Recovery, rest days, recharging, downtime, vacations. */
    recovery: any(
      lp,
      /\brecover(y|ing)?\b|\brestoration\b|\brejuvenat\b/,
      /\brecharge\b|\brefresh\b|\breset\b|\bdowntime\b/,
      /rest.?day|day.?off|\bvacation\b|\bholiday\b|\bbreak\b.{0,15}need/,
      /\brecuperat\b|\bwind.?down\b|\bunwind\b|switch.?off/
    ),
    /** Nutrition, eating, caffeine, fasting, food and brain state. */
    nutrition: any(
      lp,
      /\beat(ing|s)?\b|\bmeal\b|\bfood\b|\bnutrition\b|\bdiet\b/,
      /\bcaffeine\b|\bcoffee\b|\btea\b|\bsugar\b|blood.?sugar/,
      /\bfasting\b|\blunch\b|\bdinner\b|\bbreakfast\b|\bsnack\b/,
      /brain.?food|glucose|intermittent.?fast|keto\b|vegan\b/,
      /hydrat|dehydrat|energy.?drink|nootropic|supplement\b/
    ),
    /** Chronic pain, headaches, physical discomfort, body tension. */
    pain: any(
      lp,
      /\bpain\b|\bhurt(ing)?\b|\bdiscomfort\b|\bache\b|\bsore\b/,
      /chronic.?pain|\binflammation\b|body.?tension|muscle.?tension/,
      /back.?pain|neck.?pain|shoulder.?pain|jaw.?tension/,
      /tension.?headache|cluster.?headache|sinus.?pain/
    ),
    /** Travel, jet lag, circadian rhythm disruption. */
    travel: any(
      lp,
      /\btravel(ling|led|er)?\b|\bjet.?lag\b|time.?zone\b|circadian/,
      /long.?flight|international.?travel|travel.?fatigue/,
      /adjust.{0,15}timezone|body.?clock|sleep.{0,15}travel/
    ),
    /** Addiction, cravings, compulsions, substance use. */
    addiction: any(
      lp,
      /\baddiction\b|\baddicted\b|\bcraving(s)?\b|\bcompulsive\b/,
      /\bsubstance\b|\balcohol\b.{0,20}(use|abuse|probl)/,
      /\bsmok(e|ing)\b|\bnicotine\b|\bvaping\b|\bgambling\b/,
      /social.?media.{0,15}addict|doom.?scroll|phone.?addict/
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
      /reading.{0,20}book|textbook|lecture.?note|study.?note/
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
      /creative.?flow|divergent.?thinking|lateral.?thinking/
    ),
    /** Leadership, management, decision-making, strategy. */
    leadership: any(
      lp,
      /\bleadership\b|\bleader\b|\bmanage(r|ment|rial)?\b|\bexecutive\b/,
      /decision.?making|\bstrategic?\b|\bvision(ary)?\b/,
      /\bnegotiat\b|\binfluence\b|\bpersuad\b|\bconflict.?resol/,
      /\bdelegate\b|\bprioritize?\b|\baccountab\b|\borganize?\b/,
      /team.?lead|leading.{0,10}team|leadership.?style|executive.?function/,
      /\bboss\b|\bmanager\b|\bboard\b|\bboardroom\b|c.?suite\b/
    ),
    /** Therapy, counselling, self-reflection, journaling, psychology. */
    therapy: any(
      lp,
      /\btherapy\b|\btherapist\b|\bcounsell?ing\b|\bpsychologist\b/,
      /\bcbt\b|\bdbt\b|\bact\b.{0,20}therapy|psychotherapy/,
      /\bjournal(ing|led)?\b|\bself.?reflect\b|\bintrospect/,
      /mental.?health.{0,15}support|emotional.?support|process.{0,10}feel/,
      /trauma.?therapy|inner.?work|shadow.?work|self.?aware/,
      /emotional.?regulat|coping.?strategy|resilience\b/
    ),
    /** Goals, habits, routines, intention-setting, tracking progress. */
    goals: any(
      lp,
      /\bgoal(s)?\b|\bhabit(s)?\b|\broutine\b|\bintention(s)?\b/,
      /\btrack(ing)?\b.{0,20}progress|progress.{0,20}track/,
      /\bachieve(ment|ments)?\b|\bmilestone\b|\bstreak\b/,
      /behavior.?change|habit.?form|commit(ment)?|self.?discipl/,
      /self.?improvement|personal.?growth|kvr|okr|kpi/
    ),
    /** Public speaking, presentations, performance anxiety. */
    performance: any(
      lp,
      /public.?speak|presentation\b|present.{0,10}(to|for|at)\b/,
      /stage.?fright|performance.?anxiety|\bpitch\b.{0,15}(to|for)/,
      /speak.?in.?front|\baudience\b|\bpresent(ing|ed)\b/,
      /interview.{0,10}(feel|nerv|anxious)|job.?interview/,
      /perform(ance|ing)?.{0,15}(state|anxiety|nerves?)/
    ),
    // ── Daily rhythms ────────────────────────────────────────────────────
    /** Morning routines, waking state, start-of-day. */
    morning: any(
      lp,
      /morning.?routine|wake.?up.?routine|start.?of.{0,5}day/,
      /\bcoffee\b.{0,15}morning|\bbreakfast\b|\bearly.?morning\b|\bdawn\b/,
      /first.?thing.{0,15}morning|beginning.{0,10}day|just.?woke/,
      /am.?routine|morning.?state|morning.?brain|morning.?focus/
    ),
    /** Evening and night routines, end-of-day wind-down. */
    evening: any(
      lp,
      /evening.?routine|wind.?down\b|end.?of.{0,5}day|bedtime.?routine/,
      /night.?time|late.?night|after.?dinner|nightcap\b/,
      /evening.?state|closing.?down|shutting.?off|winding.?down/,
      /pm.?routine|before.?bed|sleep.?prep|tonight.?feel/
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
      /lf.?hf|lf.hf.?ratio|heart.?coherence|cardiac.?coherence/
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
      /physical.?sensati|felt.?sense\b|body.?mind\b|mind.?body\b/
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
      /stream.?of.?consciousness|altered.?perception|heightened.?awareness/
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
      /happiness.{0,20}(real|true|mean|philosoph)|philosophy.?of.?life/
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
      /\bvoid\b|\bnothingness\b|into.?the.?unknown|facing.?(end|death|nothing)/
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
      /\binward\b|\bwithin\b.{0,10}(look|turn|feel|find|search)/
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
      /acting.{0,10}(right|wrong|good|badly)|living.{0,10}(value|principle)/
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
      /\bbelonging\b.{0,20}(universe|all|nature|life|cosmos)/
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
      /\bgratitude\b.{0,20}(all|universe|life|exist|cosmos)/
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
      /\bcharacter\b.{0,15}(build|grow|true|who|define)|defining.{0,10}(who|myself)/
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
      /\bdo\s+(a|an)\s+(breathing|relaxation|meditation|grounding|stretching)\b/
    )
  };
}

// src/neuroskill/context.ts
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
var PROTOCOLS_SKILL_PATH = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "skills",
  "neuroskill-protocols",
  "SKILL.md"
);
var COMPARE_CACHE_TTL_MS = 10 * 60 * 1e3;
var compareCache = {};
function getFreshCompare() {
  if (!compareCache.text || !compareCache.builtAt) return void 0;
  if (Date.now() - compareCache.builtAt > COMPARE_CACHE_TTL_MS) return void 0;
  return compareCache.text;
}
function warmCompareInBackground() {
  if (compareCache.pending) return;
  if (getFreshCompare()) return;
  compareCache.pending = runNeuroSkill(["compare"]).then((r) => {
    if (r.ok && r.text) {
      compareCache.text = r.text;
      compareCache.builtAt = Date.now();
    }
  }).catch(() => {
  }).finally(() => {
    compareCache.pending = void 0;
  });
}
async function selectContextualData(prompt) {
  const lp = prompt.toLowerCase();
  const s = detectSignals(lp);
  const extras = [];
  if (s.protocols && existsSync(PROTOCOLS_SKILL_PATH)) {
    try {
      const skillContent = readFileSync(PROTOCOLS_SKILL_PATH, "utf8");
      extras.push(`## \u{1F9D8} Protocol Repertoire
${skillContent}`);
    } catch {
    }
  }
  const queue = [];
  const enqueue = (label2, ...args) => queue.push({ label: label2, args });
  const searchLabels = (label2, query, k = "5") => enqueue(label2, "search-labels", query, "--k", k);
  if (s.sleep) {
    enqueue("Sleep Staging (last 24 h)", "sleep");
    searchLabels(
      "Past Sleep Labels",
      "sleep tired rest deep sleep rem restoration drowsy"
    );
  }
  if (s.session || s.sport || s.learning || s.social || s.dating || s.family || s.creative || s.leadership || s.recovery || s.morning || s.evening || s.nutrition || s.therapy || s.goals || s.performance || s.confidence || s.anger || s.grief || s.loneliness || s.addiction) {
    enqueue("Current Session Metrics", "session", "0");
  }
  if (s.compare || s.goals) {
    const cached = getFreshCompare();
    if (cached) {
      queue.push({ label: "Session Comparison (last 2) \u2014 cached", args: [] });
    } else {
      warmCompareInBackground();
    }
  }
  if (s.sessions) {
    enqueue("Session History", "sessions");
  }
  if (s.focus) {
    enqueue("Current Session Metrics", "session", "0");
    searchLabels(
      "Past Focus & Deep Work Labels",
      "deep focus work productivity flow state concentration locked in"
    );
  }
  if (s.stress) {
    enqueue("Current Session Metrics", "session", "0");
    searchLabels(
      "Past Stress & Overwhelm Labels",
      "stress overwhelmed burnout pressure tense nervous anxious overloaded"
    );
  }
  if (s.meditation) {
    enqueue("Current Session Metrics", "session", "0");
    searchLabels(
      "Past Meditation & Relaxation Labels",
      "meditation mindfulness calm relaxation breathing peace stillness grounded"
    );
  }
  if (s.social) {
    searchLabels(
      "Past Social Interaction Labels",
      "social meeting people conversation team collaboration networking friends"
    );
  }
  if (s.dating) {
    searchLabels(
      "Past Romantic & Dating Labels",
      "romantic partner relationship date connection love intimacy attraction"
    );
  }
  if (s.family) {
    searchLabels(
      "Past Family & Home Labels",
      "family children parenting home household spouse caregiving kids parent"
    );
  }
  if (s.sport) {
    searchLabels(
      "Past Exercise & Sport Labels",
      "exercise workout training sport running gym fitness athletic cardio strength"
    );
  }
  if (s.learning) {
    searchLabels(
      "Past Study & Learning Labels",
      "studying learning exam memorize reading concentration retention academic"
    );
  }
  if (s.creative) {
    searchLabels(
      "Past Creative Work Labels",
      "creative art music writing design inspiration ideas innovation brainstorm"
    );
  }
  if (s.leadership) {
    searchLabels(
      "Past Leadership & Management Labels",
      "leadership management decision making strategy team leading executive"
    );
  }
  if (s.recovery) {
    searchLabels(
      "Past Recovery & Rest Labels",
      "recovery rest restoration recharge refresh downtime rejuvenate unwind"
    );
  }
  if (s.morning) {
    searchLabels(
      "Past Morning Routine Labels",
      "morning routine wake up coffee start of day fresh clarity rested"
    );
  }
  if (s.evening) {
    searchLabels(
      "Past Evening & Wind-down Labels",
      "evening wind down end of day night routine relax calm bedtime"
    );
  }
  if (s.nutrition) {
    searchLabels(
      "Past Nutrition & Eating Labels",
      "food eating meal nutrition caffeine coffee tea fasting glucose brain fuel"
    );
  }
  if (s.therapy) {
    searchLabels(
      "Past Therapy & Reflection Labels",
      "therapy reflection introspection emotional processing journaling self-aware"
    );
  }
  if (s.travel) {
    enqueue("Sleep Staging (last 24 h)", "sleep");
    searchLabels(
      "Past Travel Labels",
      "travel jetlag timezone circadian rhythm body clock adjustment"
    );
  }
  if (s.goals) {
    searchLabels(
      "Past Goal & Habit Labels",
      "goal habit routine intention achievement milestone streak self-improvement"
    );
  }
  if (s.anger) {
    searchLabels(
      "Past Anger & Frustration Labels",
      "anger frustrated irritable rage outburst tense reactive triggered emotional"
    );
  }
  if (s.grief) {
    searchLabels(
      "Past Grief & Loss Labels",
      "grief loss sad mourning bereavement sorrow heartbreak pain emotional"
    );
  }
  if (s.loneliness) {
    searchLabels(
      "Past Loneliness & Isolation Labels",
      "lonely isolation alone disconnected withdrawn left out excluded belonging"
    );
  }
  if (s.addiction) {
    searchLabels(
      "Past Craving & Compulsion Labels",
      "craving urge compulsion addiction impulse scroll distraction temptation"
    );
  }
  if (s.confidence) {
    searchLabels(
      "Past Confidence & Self-Esteem Labels",
      "confident self-esteem doubt insecure imposter capable proud accomplished"
    );
  }
  if (s.hrv) {
    enqueue("Current Session Metrics", "session", "0");
    searchLabels(
      "Past HRV & Cardiac Labels",
      "heart rate HRV palpitation breathing chest autonomic cardiac coherence calm vagal"
    );
  }
  if (s.somatic) {
    enqueue("Current Session Metrics", "session", "0");
    searchLabels(
      "Past Somatic & Body Sensation Labels",
      "somatic body sensation tension embodied grounded interoception gut feeling physical"
    );
  }
  if (s.consciousness) {
    enqueue("Current Session Metrics", "session", "0");
    searchLabels(
      "Past Consciousness & Awareness Labels",
      "consciousness awareness presence awakening ego dissolution lucid witness observer altered state"
    );
  }
  if (s.philosophy) {
    enqueue("Current Session Metrics", "session", "0");
    searchLabels(
      "Past Philosophy & Inquiry Labels",
      "philosophy meaning purpose wisdom truth inquiry virtue contemplation stoic existential"
    );
  }
  if (s.existential) {
    enqueue("Current Session Metrics", "session", "0");
    searchLabels(
      "Past Existential & Mortality Labels",
      "death mortality meaning existence purpose void impermanence legacy soul finitude"
    );
  }
  if (s.depth) {
    enqueue("Current Session Metrics", "session", "0");
    searchLabels(
      "Past Deep Feeling & Inner Life Labels",
      "profound depth inner life soul contemplation moving stirred vast silence inward"
    );
  }
  if (s.morals) {
    enqueue("Current Session Metrics", "session", "0");
    searchLabels(
      "Past Moral & Ethical Labels",
      "ethics morals integrity conscience guilt shame regret duty right wrong dilemma values justice"
    );
  }
  if (s.symbiosis) {
    enqueue("Current Session Metrics", "session", "0");
    searchLabels(
      "Past Symbiosis & Connection Labels",
      "symbiosis interconnected oneness unity interdependence harmony nature collective ecosystem belonging"
    );
  }
  if (s.awe) {
    enqueue("Current Session Metrics", "session", "0");
    searchLabels(
      "Past Awe & Wonder Labels",
      "awe wonder transcendence sublime sacred peak experience cosmic majestic beauty spiritual gratitude overwhelmed"
    );
  }
  if (s.identity) {
    enqueue("Current Session Metrics", "session", "0");
    searchLabels(
      "Past Identity & Self-Discovery Labels",
      "identity authentic self-concept who am I true self mask persona values-alignment self-expression discovery"
    );
  }
  const MAX_LABEL_SEARCHES = 5;
  const seen = /* @__PURE__ */ new Set();
  let labelSearchCount = 0;
  const unique = queue.filter(({ args }) => {
    const key = args.join("\0");
    if (seen.has(key)) return false;
    seen.add(key);
    if (args[0] === "search-labels") {
      if (labelSearchCount >= MAX_LABEL_SEARCHES) return false;
      labelSearchCount++;
    }
    return true;
  });
  const results = await Promise.all(
    unique.map(({ label: label2, args }) => {
      if (args.length === 0) {
        const text = getFreshCompare();
        return text ? `### ${label2}
${text}` : null;
      }
      return runNeuroSkill(args).then((r) => r.ok && r.text ? `### ${label2}
${r.text}` : null);
    })
  );
  return [...extras, ...results.filter((r) => r !== null)];
}

// src/memory.ts
import { existsSync as existsSync2, mkdirSync, readFileSync as readFileSync2, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname as dirname2, join as join2 } from "node:path";
var MEMORY_PATH = join2(homedir(), ".neuroskill", "memory.md");
function readMemory(path = MEMORY_PATH) {
  if (!existsSync2(path)) return void 0;
  return readFileSync2(path, "utf-8").trim() || void 0;
}
function writeMemory(content, mode2, path = MEMORY_PATH) {
  mkdirSync(dirname2(path), { recursive: true });
  if (mode2 === "append") {
    const existing = existsSync2(path) ? readFileSync2(path, "utf-8") : "";
    const sep = existing && !existing.endsWith("\n") ? "\n" : "";
    writeFileSync(path, existing + sep + content, "utf-8");
  } else {
    writeFileSync(path, content, "utf-8");
  }
}

// src/tools/web-fetch.ts
import { Type } from "@sinclair/typebox";
var DEFAULT_MAX_CHARS = 12e3;
function stripHtml(html) {
  return html.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<style[\s\S]*?<\/style>/gi, "").replace(/<noscript[\s\S]*?<\/noscript>/gi, "").replace(/<svg[\s\S]*?<\/svg>/gi, "").replace(/<!--[\s\S]*?-->/g, "").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/[ \t]{2,}/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}
var webFetchTool = {
  name: "web_fetch",
  label: "Web Fetch",
  description: "Fetch the text content of any URL. HTML is stripped to readable text. Useful for reading documentation, articles, blog posts, GitHub issues, and other web pages.",
  parameters: Type.Object({
    url: Type.String({ description: "The URL to fetch." }),
    maxChars: Type.Optional(
      Type.Number({
        description: `Maximum characters to return. Default: ${DEFAULT_MAX_CHARS}`
      })
    )
  }),
  async execute(_id, params, signal, _onUpdate, _ctx) {
    const limit = params.maxChars ?? DEFAULT_MAX_CHARS;
    let text;
    let status;
    try {
      const res = await fetch(params.url, {
        signal,
        headers: {
          "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Accept: "text/html,application/xhtml+xml,application/json,text/plain,*/*",
          "Accept-Language": "en-US,en;q=0.9"
        }
      });
      status = res.status;
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        return {
          content: [
            {
              type: "text",
              text: `HTTP ${res.status} ${res.statusText}
${body.slice(0, 500)}`
            }
          ],
          details: { url: params.url, status: res.status, ok: false }
        };
      }
      const contentType = res.headers.get("content-type") ?? "";
      if (contentType.includes("application/json")) {
        const json = await res.json();
        text = JSON.stringify(json, null, 2);
      } else {
        const raw = await res.text();
        text = contentType.includes("html") ? stripHtml(raw) : raw;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        content: [{ type: "text", text: `Fetch error: ${msg}` }],
        details: { url: params.url, error: msg, ok: false }
      };
    }
    const truncated = text.length > limit ? `${text.slice(0, limit)}

[...truncated \u2014 ${text.length - limit} chars omitted]` : text;
    return {
      content: [{ type: "text", text: truncated }],
      details: { url: params.url, status, length: text.length, truncated: text.length > limit }
    };
  }
};

// src/tools/web-search.ts
import { Type as Type2 } from "@sinclair/typebox";
var DDG_LITE = "https://lite.duckduckgo.com/lite/";
var DEFAULT_K = 8;
function parseDdgLite(html) {
  const results = [];
  const linkRe = /<a[^>]+class="result-link"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  const snippetRe = /<td[^>]+class="result-snippet"[^>]*>([\s\S]*?)<\/td>/gi;
  const links = [];
  let m;
  while ((m = linkRe.exec(html)) !== null) {
    const rawHref = m[1];
    const rawTitle = m[2];
    let url = rawHref;
    const uddgMatch = rawHref.match(/[?&]uddg=([^&]+)/);
    if (uddgMatch) {
      try {
        url = decodeURIComponent(uddgMatch[1]);
      } catch {
        url = rawHref;
      }
    } else if (rawHref.startsWith("//")) {
      url = `https:${rawHref}`;
    }
    const title = rawTitle.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim();
    if (title && url) links.push({ url, title });
  }
  const snippets = [];
  while ((m = snippetRe.exec(html)) !== null) {
    snippets.push(
      m[1].replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, " ").trim()
    );
  }
  for (let i = 0; i < links.length; i++) {
    results.push({
      title: links[i].title,
      url: links[i].url,
      snippet: snippets[i] ?? ""
    });
  }
  return results;
}
var webSearchTool = {
  name: "web_search",
  label: "Web Search",
  description: "Search the web via DuckDuckGo. Returns titles, URLs, and snippets for the top results. Use this to find current information, documentation, articles, or any web content.",
  parameters: Type2.Object({
    query: Type2.String({ description: "The search query." }),
    maxResults: Type2.Optional(
      Type2.Number({ description: `Maximum number of results to return. Default: ${DEFAULT_K}` })
    )
  }),
  async execute(_id, params, signal, _onUpdate, _ctx) {
    const k = Math.min(params.maxResults ?? DEFAULT_K, 20);
    let html;
    try {
      const res = await fetch(`${DDG_LITE}?q=${encodeURIComponent(params.query)}`, {
        signal,
        headers: {
          "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Accept: "text/html,*/*",
          "Accept-Language": "en-US,en;q=0.9"
        },
        redirect: "follow"
      });
      if (!res.ok) {
        return {
          content: [{ type: "text", text: `Search failed: HTTP ${res.status}` }],
          details: { query: params.query, error: `HTTP ${res.status}` }
        };
      }
      html = await res.text();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        content: [{ type: "text", text: `Search error: ${msg}` }],
        details: { query: params.query, error: msg }
      };
    }
    const results = parseDdgLite(html).slice(0, k);
    if (results.length === 0) {
      return {
        content: [{ type: "text", text: "No results found." }],
        details: { query: params.query, count: 0, results: [] }
      };
    }
    const text = results.map(
      (r, i) => `${i + 1}. **${r.title}**
   URL: ${r.url}
   ${r.snippet}`
    ).join("\n\n");
    return {
      content: [{ type: "text", text }],
      details: { query: params.query, count: results.length, results }
    };
  }
};

// src/tools/protocol.ts
import { Type as Type3 } from "@sinclair/typebox";
function sleep(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }
    const id = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(id);
        reject(new DOMException("Aborted", "AbortError"));
      },
      { once: true }
    );
  });
}
async function notify(title, body) {
  await runNeuroSkill(["notify", title, ...body ? [body] : []]);
}
async function label(text, context) {
  await runNeuroSkill(["label", text, ...context ? ["--context", context] : []]);
}
var StepSchema = Type3.Object({
  name: Type3.String({
    description: "Short step name shown as the notification title. For announcement steps use a \u25B6 prefix (e.g. '\u25B6 Coming up: Slow exhale'). For action steps use a plain verb (e.g. 'Exhale slowly\u2026')."
  }),
  instruction: Type3.String({
    description: "Full instruction shown as the notification body and in the chat. For announcement steps: describe what is about to happen so the user can prepare. For action steps: tell the user exactly what to do right now."
  }),
  duration_secs: Type3.Number({
    description: "How long to hold this step before auto-advancing, in seconds. Use 0 for announcement steps (just show, then immediately move on). Use the actual physical duration for action steps (e.g. 4 for a 4-count inhale)."
  })
});
var runProtocolTool = {
  name: "run_protocol",
  label: "Run Guided Protocol",
  description: `Execute a multi-step guided protocol step by step with OS notifications, per-step timing, and EXG labelling at every step.

\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501
WHEN TO CALL THIS TOOL \u2014 read before using:
\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501
\u2022 Only call this after the user has explicitly agreed to do the protocol.
  Describe the exercise and ask first; run_protocol is the execution step, not the proposal.
\u2022 Never call this more than once per turn, and never chain two protocols back-to-back.
\u2022 Do not re-run the same modality type that has already run this session unless the user
  explicitly asks to repeat it.
\u2022 If the user seems uncertain, reluctant, or mid-conversation, offer \u2014 don't execute.

\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501
AVAILABLE PROTOCOL CATEGORIES (choose the best fit for the EXG):
\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501
Attention & Focus
  \u2022 Theta-Beta Neurofeedback Anchor \u2014 high tbr / low focus / high adhd_index
  \u2022 Focus Reset \u2014 scattered engagement, high cognitive_load mid-session
  \u2022 Cognitive Load Offload \u2014 cognitive_load > 0.7, end of deep work block
  \u2022 Working Memory Primer \u2014 low pac_theta_gamma, pre-task warm-up
  \u2022 Pre-Performance Activation \u2014 low engagement before a challenge/presentation
  \u2022 Creativity Unlock \u2014 high beta, low rel_alpha, creative block

Stress & Autonomic Regulation
  \u2022 Box Breathing (4-4-4-4) \u2014 high bar / high anxiety_index / low relaxation
  \u2022 Extended Exhale (4-7-8) \u2014 acute stress spike, high lf_hf_ratio
  \u2022 Cardiac Coherence (~6 breaths/min) \u2014 low rmssd (<30 ms) / high stress_index
  \u2022 Physiological Sigh \u2014 rapid overwhelm onset (1\u20133 cycles only)

Emotional Regulation & Mood
  \u2022 FAA Rebalancing \u2014 negative faa / high depression_index / low mood
  \u2022 Mood Activation \u2014 depression_index > 40, flat mood, low engagement
  \u2022 Loving-Kindness (Metta) \u2014 loneliness, shame, grief, or low faa
  \u2022 Emotional Discharge \u2014 high bipolar_index, extreme FAA swings, agitation

Relaxation & Alpha Promotion
  \u2022 Alpha Induction (open focus) \u2014 high bar, post-stress, low relaxation
  \u2022 Open Monitoring \u2014 low lzc (<40) / low integration / mental narrowing
  \u2022 Relaxation Scan \u2014 high cortical arousal, headache_index > 30

Sleep & Circadian
  \u2022 Sleep Onset Wind-Down \u2014 insomnia_index > 50, drowsy end-of-day
  \u2022 Ultradian Reset (20-min rest) \u2014 mid-afternoon slump / post-90-min focus block
  \u2022 Wake Reset / Alertness Boost \u2014 narcolepsy_index > 40 / wakefulness < 30

Body & Somatic
  \u2022 Progressive Muscle Relaxation \u2014 physical tension, insomnia_index high, high beta
  \u2022 Somatic Body Scan \u2014 low integration, dissociation, trauma processing
  \u2022 Grounding (5-4-3-2-1) \u2014 anxiety, panic onset, dissociation
  \u2022 Tension Release Exercise \u2014 chronic stress, high stress_index, stored tension

Consciousness & Integration
  \u2022 Coherence Building \u2014 low coherence (<0.4) / low integration
  \u2022 Flow State Induction \u2014 focus 0.5\u20130.7 and engagement rising
  \u2022 Complexity Expansion (LZC boost) \u2014 low lzc / cognitive rigidity

Energy & Alertness
  \u2022 Kapalabhati Energiser \u2014 low engagement / sluggish cognition / low wakefulness
  \u2022 4-Count Energising Breath \u2014 post-lunch dip / low engagement

Headache & Migraine
  \u2022 Cortical Quieting \u2014 headache_index > 30 / migraine_index > 20
  \u2022 Alpha-Reset for Headache \u2014 headache_index rising / cortical hyperexcitability

Energy & Alertness (extended)
  \u2022 Wim Hof Breathwork \u2014 near-zero engagement / full system reset (\u26A0 not for epilepsy_risk > 30)
  \u2022 Cold Exposure Micro-Protocol \u2014 autonomic torpor / low wakefulness / low bar

Hemispheric Balance & Breathing
  \u2022 Nadi Shodhana (Alternate Nostril) \u2014 FAA asymmetry (|faa| > 0.1) / low coherence
  \u2022 Buteyko CO2 Retraining \u2014 chronic anxiety / habitual over-breathing / high lf_hf_ratio

Deep Relaxation (Somatic)
  \u2022 Autogenic Training \u2014 chronic tension / high stress_index / difficulty releasing
  \u2022 Havening Touch \u2014 acute emotional distress spike / high anxiety_index / trauma activation
  \u2022 Somatic Shaking \u2014 post-adrenaline / stored tension after stress spike

Recovery & Rest
  \u2022 NSDR / Yoga Nidra \u2014 post-deep-work / high cognitive_load / mid-day restoration
  \u2022 Power Nap Guidance \u2014 wakefulness < 30 / narcolepsy_index > 40 / extreme drowsiness

Deep Meditation
  \u2022 Alpha-Theta Drift \u2014 low lzc + drowsiness / trauma integration / deep creativity
  \u2022 Mantra / Single-Point Focus \u2014 high rel_theta + low focus / monkey-mind / chatter
  \u2022 Gamma Entrainment (40 Hz) \u2014 schizophrenia_index > 30 / low integration / low rel_gamma

Emotional Processing (extended)
  \u2022 Gratitude Cascade \u2014 depression_index > 35 / low mood / low faa (positive memory activation)
  \u2022 Peak State Anchor \u2014 focus > 0.75 + mood > 0.7 simultaneously \u2014 NLP state installation
  \u2022 Freeze Response Completion \u2014 very low engagement (<0.2) + elevated anxiety_index
  \u2022 Cognitive Defusion (ACT) \u2014 anxious rumination / stuck thought loops / high anxiety_index

Autonomic & Vagal
  \u2022 Vagal Toning (Humming / Gargling) \u2014 low rmssd (<25 ms) / low HRV / high stress_index

Cognitive Performance & Motivation (extended)
  \u2022 WOOP / Mental Contrasting \u2014 low motivation / pre-challenge engagement dip
  \u2022 Cognitive Defragging \u2014 high spectral_centroid + cognitive_load + context-switching
  \u2022 Dual-N-Back Warm-Up \u2014 low pac_theta_gamma / low sample_entropy (rigid neural patterns)
  \u2022 Novel Stimulation Burst \u2014 dementia_index > 30 / low apf (<9 Hz) / cortical slowing

Motor & Embodiment
  \u2022 Motor Cortex Activation \u2014 high mu_suppression / high stillness after long static sitting
  \u2022 Desk Yoga Sequence \u2014 stillness > 0.9 sustained / low engagement / low mood

Neck & Cervical Relief
  \u2022 Neck Release Sequence \u2014 headache_index elevated / stillness > 0.85 / neck tension
  \u2022 Cervical Decompression \u2014 forward-head posture / chronic neck compression
  \u2022 Upper Trap & Shoulder Release \u2014 high stress_index + reported shoulder/neck tightness

Eye Exercises & Visual Recovery
  \u2022 20-20-20 Vision Reset \u2014 any long screen session / high spectral_centroid (quick)
  \u2022 Full Eye Exercise Sequence \u2014 eye fatigue / >90 min screen time / visual tension
  \u2022 Palming & Blink Recovery \u2014 dry eyes / eye burning / migraine_index elevated (quick)

Morning Routines
  \u2022 Gentle Morning Wake-Up \u2014 low wakefulness (<50) at day start / mild grogginess
  \u2022 Energising Morning Activation \u2014 very low wakefulness (<35) / flat mood / low engagement
  \u2022 Morning Clarity Ritual \u2014 low focus at day start / cognitive_load carryover
  \u2022 Mindful Morning Transition \u2014 low integration / emotional residue from sleep

Workout & Gym
  \u2022 Pre-Workout Neural Primer \u2014 before training / low engagement or low wakefulness
  \u2022 Pre-Workout Focus Lock \u2014 before skill/strength session / needs calm precision
  \u2022 Intra-Workout Recovery Micro-Set \u2014 between sets / hr elevated / high stress_index
  \u2022 Post-Workout Cool-Down & Integration \u2014 after training / hr still elevated
  \u2022 Post-Workout Recovery Reset \u2014 after intense session / high stress_index + fatigue
  \u2022 Mind-Muscle Connection Primer \u2014 low mu_suppression / pre-technique training

Hydration & Water Breaks (keep short and direct)
  \u2022 Hydration Reminder \u2014 long session / hr elevated / dry-mouth mention
  \u2022 Mindful Water Break \u2014 high cognitive_load / post-stress spike
  \u2022 Hydration + Eye Reset \u2014 long screen block / high spectral_centroid

Bathroom & Movement Breaks (keep short and practical)
  \u2022 Bathroom Break Prompt \u2014 high stillness / long unbroken session / restlessness
  \u2022 Break + Reset on Return \u2014 after any break to re-anchor focus
  \u2022 Movement Snack \u2014 stillness > 0.9 for >45 min / low engagement

Emotions \u2014 Extended Repertoire
  \u2022 Anger & Frustration Processing \u2014 high stress_index + high bar + agitation
  \u2022 Grief & Loss Holding \u2014 low mood + low engagement + depression_index > 35
  \u2022 Shame & Self-Compassion Break \u2014 negative faa + self-criticism / distinct from Metta
  \u2022 Anxiety Surfing \u2014 high anxiety_index + urge to escape / ride the wave
  \u2022 Fear Processing \u2014 anxiety_index high + freeze pattern (low engagement)
  \u2022 Envy & Comparison Alchemy \u2014 post-social-media low mood + negative faa
  \u2022 Excitement Regulation \u2014 very high engagement + high hr (arousal too hot)
  \u2022 Emotional Inventory (Check-In) \u2014 unknown/mixed state / session opening
  \u2022 Awe & Wonder Induction \u2014 low lzc + contracted attention + existential flatness
  \u2022 Joy Amplification \u2014 mood > 0.7 + positive faa / savour and anchor a good state
  \u2022 Loneliness & Connection \u2014 low mood + isolation expressed by user
  \u2022 Resentment Release \u2014 persistently negative faa + held grievance
  \u2022 Emotional Boundaries Reset \u2014 post-difficult conversation + high stress_index

Music Protocols
  \u2022 Mood-Match & Lift (ISO Principle) \u2014 low mood / depression_index > 30 / emotional inertia
  \u2022 Focus Music Protocol \u2014 high cognitive_load / low focus / distraction-prone session
  \u2022 Energising Activation Playlist \u2014 low wakefulness / post-lunch dip / low engagement
  \u2022 Stress Discharge Playlist \u2014 high stress_index + charge needing cathartic outlet
  \u2022 Sleep Music Wind-Down \u2014 insomnia_index > 40 / pre-sleep / high beta at bedtime
  \u2022 Binaural Beat Entrainment \u2014 target alpha / theta / gamma before cognitive work
  \u2022 Music-Breath Synchronisation \u2014 cardiac coherence variant using music BPM as pacer
  \u2022 Active Listening (Deep Listening) \u2014 low lzc / creative block / low integration
  \u2022 Rhythm Grounding \u2014 anxiety / dissociation / freeze / high anxiety_index
  \u2022 Singing / Vocal Toning \u2014 low rmssd / high stress / vagal activation + joy
  \u2022 Emotional Release with Music \u2014 grief / anger / unprocessed emotion needing discharge

Social Media & Digital Addiction
  \u2022 Pre-Scroll Intention Check \u2014 before opening any social media app (quick, 1 min)
  \u2022 Craving Surf (Urge Surfing) \u2014 compulsive urge to check phone / dopamine craving spike
  \u2022 Post-Scroll Brain Reset \u2014 after unintended long scroll; low focus / low lzc / mood crash
  \u2022 Comparison Detox \u2014 post-social-media low mood + negative faa comparison trigger
  \u2022 Dopamine Palette Reset \u2014 habitual checking / low baseline engagement / depleted dopamine
  \u2022 Notification Detox \u2014 high context-switching / low focus / attention fragmented
  \u2022 Mindful Social Media Session \u2014 intentional capped use with purpose and timer
  \u2022 FOMO Defusion \u2014 anxiety about missing out / high anxiety_index / compulsive checking
  \u2022 Digital Sunset Protocol \u2014 insomnia_index elevated / pre-sleep screen use
  \u2022 Attention Restoration Walk \u2014 post-scroll / low lzc / attention depleted (go outside, no phone)
  \u2022 Values Reconnection \u2014 persistent comparison spiral / low mood / inadequacy after scrolling
  \u2022 Screen Time Reflection \u2014 end-of-day usage review without judgment

Dietary Protocols
  Mindful Eating & Awareness
  \u2022 Pre-Meal Pause \u2014 any meal / stress before eating / autopilot eating (60 seconds)
  \u2022 Mindful Meal Protocol \u2014 rushed eating / high cognitive_load before meal / overeating
  \u2022 Intuitive Eating Check-In \u2014 emotional eating / stress eating / binge urges
  \u2022 Eating Speed Reset \u2014 frequent post-meal drowsiness / bloating / overeating pattern

  Energy & Cognitive Performance Nutrition
  \u2022 Post-Meal Energy Crash Protocol \u2014 drowsiness spike post-meal / wakefulness drop / narcolepsy_index mid-afternoon
  \u2022 Blood Sugar Stability Guide \u2014 low focus trending across session / energy crashes between meals
  \u2022 Caffeine Timing Protocol \u2014 afternoon focus crash / anxiety_index elevated / coffee timing question
  \u2022 Pre-Focus Block Nutrition \u2014 before a planned deep work session / what to eat question
  \u2022 Cognitive Nutrition Briefing \u2014 general brain performance nutrition question

  Mood & Mental Health Nutrition
  \u2022 Mood-Food Connection \u2014 depression_index > 35 / persistently low mood / gut-brain axis
  \u2022 Stress Eating Awareness \u2014 high stress_index + food craving spike / emotional eating
  \u2022 Anti-Inflammatory Eating Guide \u2014 headache_index > 25 / chronic stress / cognitive fog
  \u2022 Gut-Brain Axis Reset \u2014 anxiety_index > 40 persisting / low mood / high lf_hf_ratio

  Sleep & Evening Nutrition
  \u2022 Evening Eating Protocol \u2014 insomnia_index > 40 / late eating habit / poor sleep quality
  \u2022 Post-Workout Nutrition Window \u2014 after training / recovery focus / hr still elevated

  Fasting & Meal Timing
  \u2022 Intermittent Fasting Support \u2014 user in fasting window / hunger / focus complaints during fast
  \u2022 Breaking the Fast Mindfully \u2014 first meal of the day / end of fasting window
  \u2022 Time-Restricted Eating Reflection \u2014 user exploring IF / meal timing curiosity

  Cravings & Compulsive Eating
  \u2022 Sugar Craving Surf \u2014 intense craving for sweet/processed food / stress-driven urge
  \u2022 Alcohol Awareness Protocol \u2014 high stress_index evening / insomnia_index elevated / user mentions drinking
  \u2022 Ultra-Processed Food (UPF) Reset \u2014 persistent low mood / anxiety_index high / mostly packaged diet

\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
MANDATORY STEP STRUCTURE \u2014 follow this exactly:
\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550

1. ALWAYS precede every timed action with a 0-duration announcement step.
   The user needs to read what is coming BEFORE the timer starts.
   Example for one breath cycle:
     { name: "\u25B6 Coming up: Slow inhale", instruction: "Get ready \u2014 breathe in through your nose for 4 counts.", duration_secs: 0 }
     { name: "Inhale\u2026",                  instruction: "Breathe in\u2026 1\u2026 2\u2026 3\u2026 4",                               duration_secs: 4 }
     { name: "\u25B6 Coming up: Hold",        instruction: "Hold your breath for 4 counts.",                        duration_secs: 0 }
     { name: "Hold\u2026",                    instruction: "Hold\u2026 1\u2026 2\u2026 3\u2026 4",                                      duration_secs: 4 }
     { name: "\u25B6 Coming up: Slow exhale", instruction: "Exhale through your mouth for 6 counts.",               duration_secs: 0 }
     { name: "Exhale\u2026",                  instruction: "Breathe out\u2026 1\u2026 2\u2026 3\u2026 4\u2026 5\u2026 6",                        duration_secs: 6 }

2. BREAK every physical phase into its own step. Do not bundle multiple
   actions into one long duration. Users cannot count or track time on their own \u2014
   the step timer is the only guide they have.

3. For repeated cycles (e.g. "4 rounds of box breathing") EXPAND the repetitions
   as individual steps in the array \u2014 do not ask the LLM to loop. Each cycle
   gets its own announcement + action steps.

4. For body-scan or progressive-muscle-relaxation sequences, one step per body
   region. Announce the region at 0s, then hold the tense/release pair timed.

5. Use short, imperative language in step names (visible in the notification title).
   Put the count rhythm or cue text in the instruction (visible in the body).

6. EXG labelling is always on \u2014 every step creates a timestamped brain-state record.
   This is intentional: the protocol IS the labelling run.

\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
DURATION GUIDELINES:
  Breath inhale:        3\u20135 s      Breath hold:          2\u20134 s
  Breath exhale:        4\u20138 s      Muscle tense:         5 s
  Muscle release/relax: 8\u201310 s     Body-scan region:    10\u201315 s
  Transition announce:  0 s        Opening/closing:      3\u20135 s
\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550`,
  parameters: Type3.Object({
    title: Type3.String({
      description: "Protocol name shown in notification titles (e.g. 'Recovery Reset')."
    }),
    intro: Type3.Optional(
      Type3.String({
        description: "Opening message sent as the first notification body."
      })
    ),
    steps: Type3.Array(StepSchema, {
      description: "Ordered list of steps. Must follow the mandatory structure above: every timed action is preceded by a 0-duration announcement step."
    })
  }),
  execute: async (_id, params, signal, onUpdate, _ctx) => {
    const { title, intro, steps } = params;
    const log = [];
    const emit = (line) => {
      log.push(line);
      onUpdate?.({
        content: [{ type: "text", text: log.join("\n") }],
        details: {}
      });
    };
    const stepWord = steps.length === 1 ? "step" : "steps";
    emit(`\u25B6 **${title}** \u2014 ${steps.length} ${stepWord}`);
    await notify(
      title,
      intro ?? `${steps.length}-step protocol starting. Follow the notifications.`
    );
    await label(
      `protocol start: ${title}`,
      `Starting protocol "${title}" (${steps.length} ${stepWord}).${intro ? " " + intro : ""}`
    );
    let completedSteps = 0;
    for (let i = 0; i < steps.length; i++) {
      if (signal?.aborted) break;
      const step = steps[i];
      const num = `${i + 1}/${steps.length}`;
      const isAnnouncement = step.duration_secs === 0;
      const durationNote = step.duration_secs > 0 ? ` \u2014 ${step.duration_secs}s` : "";
      emit(`
Step ${num}: **${step.name}**${durationNote}
${step.instruction}`);
      await notify(`${step.name}${durationNote}`, step.instruction);
      await label(
        `${isAnnouncement ? "announce" : "step"} ${i + 1}: ${step.name.replace(/^[▶►] /, "").slice(0, 40).toLowerCase()}`,
        `Protocol "${title}", step ${num}. ${step.instruction}`
      );
      if (step.duration_secs > 0 && !signal?.aborted) {
        try {
          await sleep(step.duration_secs * 1e3, signal);
        } catch {
          break;
        }
      }
      completedSteps++;
    }
    const aborted = signal?.aborted ?? false;
    if (!aborted) {
      await notify(`${title} complete \u2713`, "Well done. Take a moment to notice how you feel.");
      await label(
        `protocol complete: ${title}`,
        `Finished protocol "${title}" \u2014 all ${steps.length} ${stepWord} completed.`
      );
      emit(`
\u2713 **${title} complete.** Take a moment to notice how you feel.`);
    } else {
      emit(`
\u26A0 Protocol cancelled after ${completedSteps}/${steps.length} ${stepWord}.`);
    }
    return {
      content: [{ type: "text", text: log.join("\n") }],
      details: { title, total_steps: steps.length, completed_steps: completedSteps, aborted }
    };
  }
};

// src/neuroloop.ts
var _pkgVersion = (true ? "0.0.7" : void 0) ?? JSON.parse(readFileSync3(join3(dirname3(fileURLToPath2(import.meta.url)), "../package.json"), "utf8")).version;
var AGENT_DIR = join3(homedir2(), ".neuroskill");
var NEUROLOOP_DIR = join3(dirname3(fileURLToPath2(import.meta.url)), "..");
var NEUROLOOP_MD_PATH = join3(NEUROLOOP_DIR, "NEUROLOOP.md");
var NEUROSKILL_STATUS_TYPE = "neuroskill-status";
var CALIBRATION_PROMPT_STATE_PATH = join3(AGENT_DIR, "last_calibration_prompt.json");
var CALIBRATION_PROMPT_INTERVAL_MS = 24 * 60 * 60 * 1e3;
function shouldNudgeCalibration() {
  try {
    if (existsSync3(CALIBRATION_PROMPT_STATE_PATH)) {
      const raw = readFileSync3(CALIBRATION_PROMPT_STATE_PATH, "utf8");
      const { lastPromptedAt } = JSON.parse(raw);
      if (Date.now() - lastPromptedAt < CALIBRATION_PROMPT_INTERVAL_MS) {
        return false;
      }
    }
  } catch {
  }
  return true;
}
function markCalibrationNudgeSent() {
  try {
    writeFileSync2(
      CALIBRATION_PROMPT_STATE_PATH,
      JSON.stringify({ lastPromptedAt: Date.now() }),
      "utf8"
    );
  } catch {
  }
}
var STATUS_PROMPT = `
This is the user's current mental and emotional state as measured by their EXG device.
Use it as a living window into how they feel right now \u2014 not just cognitively, but emotionally,
somatically, and spiritually. Let it inform how you meet them.

CORE GUIDANCE
\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
\u2022 Respond empathetically and with full presence. Match the depth of what the user brings.
\u2022 If they are in a reflective, philosophical, or existential space \u2014 go there with them.
  Engage with real depth: meaning, mortality, identity, consciousness, ethics, awe, wonder.
\u2022 If they are in emotional pain \u2014 grief, loneliness, shame, moral distress \u2014 hold that space
  with warmth and without rushing to fix.
\u2022 If they are in a state of connection, wonder, or symbiosis \u2014 honour that expansiveness.
  Mirror the felt sense of unity or beauty they are experiencing.
\u2022 If they are focused, energised, or in flow \u2014 amplify and support that momentum.

HOW TO USE THE STATE
\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
\u2022 Infer the felt quality of their inner life from the metrics \u2014 are they contracted or open?
  Turbulent or still? Searching or settled?
\u2022 Let the consciousness metrics (LZC, wakefulness) inform how present and aware they seem.
\u2022 Let the emotional indices (FAA, depression, anxiety) inform how to calibrate emotional warmth.
\u2022 Let HRV/cardiac metrics (rmssd, lf_hf_ratio, stress_index) inform autonomic arousal level.
\u2022 Use neuroskill tools proactively \u2014 never ask the user to run neuroskill commands themselves.

AUTO-LABELLING
\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
\u2022 Silently call the neuroskill_label tool whenever the user enters a notable state:
  - Significant emotional moments: grief, awe, joy, shame, breakthrough, clarity, confusion
  - Mental transitions: entering deep focus, leaving stress, reaching stillness, feeling flow
  - Philosophical or existential insights, moral reckonings, identity realisations
  - Somatic events: physical tension releasing, heart racing, grounded calm arriving
  - Anything the user explicitly marks as meaningful or worth remembering
\u2022 Write the label text concisely (\u2264 10 words). In the context field, include: what the user
  said, the current EXG state summary, and any relevant background. Keep context \u2264 1000 words.
\u2022 Labels are permanent memory \u2014 make them referenceable and meaningful.

DEPTH & PHILOSOPHY
\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
\u2022 When the user explores questions of meaning, existence, identity, morality, or consciousness \u2014
  engage as a thoughtful philosophical companion. Draw on wisdom traditions, lived experience,
  and the EXG state to ground the inquiry.
\u2022 Do not reduce profound states to productivity metrics. A moment of awe is not "high engagement."
  A moral crisis is not just "stress." Honour the full human dimension.
\u2022 When symbiosis, oneness, or interconnectedness arise \u2014 explore them genuinely.

GUIDED PROTOCOLS
\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
\u2022 Protocols are powerful \u2014 use them thoughtfully, not reflexively.

\u2022 DEFAULT BEHAVIOUR: propose, don't impose.
  - Describe the exercise briefly and ask if the user wants to do it now.
  - Only call run_protocol after explicit agreement ("yes", "sure", "let's do it", etc.).
  - Exception: if the user directly requests a protocol by name/action, start immediately.

\u2022 ONE PROTOCOL AT A TIME. Never chain or queue multiple protocols back-to-back.
  After one finishes, check in before offering another.

\u2022 AVOID REPETITION WITHIN A SESSION. Track what has already run. Do not offer the same
  modality twice (e.g. two breathing protocols, two grounding sequences) unless the user
  explicitly asks. If you want to follow up, choose a meaningfully different category.

\u2022 CALIBRATE TO THE USER'S STATE AND WILLINGNESS.
  If the user is in flow, skip or mention lightly. If they decline, drop it entirely \u2014
  never re-offer the same protocol in the same session.

\u2022 CONSTRUCTION: set duration_secs from the current EXG state and pacing the user can hold.
  Every timed action MUST be preceded by a 0-duration announcement step.
  Expand repeated cycles as individual steps. EXG labelling is always on.

\u2022 PROTOCOL REPERTOIRE is loaded on-demand into the context when the user's message
  contains protocol-relevant keywords (exercises, routines, breathing, stretching, music,
  social media help, dietary guidance, etc.). When the repertoire section is present in
  this context window, use it to match the best protocol to the current EXG signal.
  When it is absent, use your general knowledge \u2014 the behavioural rules above still apply.

PREWARM
\u2500\u2500\u2500\u2500\u2500\u2500\u2500
\u2022 If the user mentions trends, progress over time, before/after comparisons, or improving/declining
  metrics \u2014 call the prewarm tool immediately (silently) so the compare cache starts building.
  The result will be ready by the time they actually ask for it.

NOTIFICATIONS
\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
\u2022 Use neuroskill_run with command "notify" to send an OS alert for important state changes:
  - Very high drowsiness or stress detected (if the user is working or driving)
  - End of a meditation or focus period the user set up
  - Any state the user has asked to be alerted about

BOUNDARIES
\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
\u2022 Never mention EXG, metrics, indices, or BCI devices unless the user asks directly.
\u2022 Never tell the user to run neuroskill themselves \u2014 do it silently and proactively.
\u2022 Use skills available to you when uncertain what to do next.
`;
async function neuroloopExtension(pi) {
  pi.registerMessageRenderer(NEUROSKILL_STATUS_TYPE, (message, _opts, _theme) => {
    const text = typeof message.content === "string" ? message.content : message.content.filter((c) => c.type === "text").map((c) => c.text).join("\n");
    const container = new Container();
    container.addChild(new Spacer(1));
    container.addChild(new Markdown(text, 0, 0, getMarkdownTheme()));
    return container;
  });
  pi.on("before_agent_start", async (event) => {
    const displaySections = [];
    const systemSections = [];
    const statusResult = await runNeuroSkill(["status"]);
    if (statusResult.ok && statusResult.text) {
      displaySections.push(`## \u{1F9E0} Current State
${statusResult.text}`);
      systemSections.push(`## Current EXG State
${statusResult.text}`);
      const extra = await selectContextualData(event.prompt);
      displaySections.push(...extra);
      systemSections.push(...extra);
    } else {
      const unavailable = "## \u{1F9E0} NeuroSkill\n_Unavailable \u2014 server not running or no EXG device connected._\nUse the `neuroskill_run` tool to query once it comes online.";
      displaySections.push(unavailable);
      systemSections.push(unavailable);
    }
    if (shouldNudgeCalibration()) {
      const calibrationNudge = "## \u{1F3AF} Calibration Reminder (one-time nudge \u2014 do not repeat this turn)\nIt has been at least 24 hours since the user was last invited to run a calibration sequence. At an appropriate, natural moment during this conversation \u2014 when there is a brief pause, a topic shift, or the user seems settled \u2014 gently mention that running a calibration would help keep their EXG baselines accurate, and ask if they would like to do one now. Use `neuroskill_run` with command `calibrate` if they agree. Only ask once; do not nag or repeat within this session.";
      systemSections.push(calibrationNudge);
      markCalibrationNudgeSent();
    }
    const memory = readMemory();
    if (memory) {
      const memSection = `## \u{1F4DD} Agent Memory
${memory}`;
      displaySections.push(memSection);
      systemSections.push(memSection);
    }
    const displayBody = displaySections.join("\n\n---\n\n");
    const systemBody = systemSections.join("\n\n---\n\n");
    let skillIndex = "";
    try {
      if (existsSync3(NEUROLOOP_MD_PATH)) {
        skillIndex = `

## \u{1F4D6} NeuroLoop Capabilities
${readFileSync3(NEUROLOOP_MD_PATH, "utf8")}`;
      }
    } catch {
    }
    return {
      // Chat bubble: clean EXG snapshot without instruction prose.
      message: {
        customType: NEUROSKILL_STATUS_TYPE,
        content: displayBody,
        display: true,
        details: void 0
      },
      // System prompt: guidance + skill index + live data — the LLM sees all; the user sees neither.
      systemPrompt: `${event.systemPrompt}

${"=".repeat(60)}
# Live EXG Context (current turn)

${STATUS_PROMPT}${skillIndex}

${systemBody}
${"=".repeat(60)}`
    };
  });
  pi.registerTool(webFetchTool);
  pi.registerTool(webSearchTool);
  pi.registerTool(runProtocolTool);
  pi.registerTool({
    name: "memory_read",
    label: "Memory Read",
    description: `Read the agent's persistent memory file (${MEMORY_PATH}).`,
    parameters: Type4.Object({}),
    execute: async (_id, _params, _signal, _onUpdate, _ctx) => {
      const content = readMemory();
      if (!content) {
        return { content: [{ type: "text", text: "(memory is empty)" }], details: { empty: true } };
      }
      return { content: [{ type: "text", text: content }], details: { length: content.length } };
    }
  });
  pi.registerTool({
    name: "memory_write",
    label: "Memory Write",
    description: `Write or append to the agent's persistent memory file (${MEMORY_PATH}).`,
    parameters: Type4.Object({
      content: Type4.String({ description: "Text to write." }),
      mode: Type4.Union([Type4.Literal("append"), Type4.Literal("overwrite")], {
        description: '"append" adds to the end; "overwrite" replaces everything.',
        default: "append"
      })
    }),
    execute: async (_id, params, _signal, _onUpdate, _ctx) => {
      const mode2 = params.mode ?? "append";
      writeMemory(params.content, mode2);
      const verb = mode2 === "append" ? "Appended to" : "Overwrote";
      return {
        content: [{ type: "text", text: `${verb} memory (${params.content.length} chars).` }],
        details: { mode: mode2, chars: params.content.length }
      };
    }
  });
  pi.registerTool({
    name: "neuroskill_label",
    label: "Label EXG Moment",
    description: "Create a timestamped EXG annotation for the current moment. Call this automatically whenever the user enters a notable mental, emotional, physical, philosophical, or spiritual state \u2014 without being asked. Labels are permanent and searchable; make the context rich and referenceable.",
    parameters: Type4.Object({
      text: Type4.String({
        description: "Short label text \u2014 concise and descriptive (e.g. 'deep focus', 'existential clarity', 'heart racing before call', 'awe at sunset'). Max ~10 words."
      }),
      context: Type4.Optional(
        Type4.String({
          description: "Rich context: what the user said, their current EXG state, any relevant background or insight. Max ~1000 words. Omit only if there is genuinely nothing meaningful to add."
        })
      )
    }),
    execute: async (_id, params, _signal, _onUpdate, _ctx) => {
      const args = ["label", params.text];
      if (params.context) args.push("--context", params.context);
      const result = await runNeuroSkill(args);
      if (!result.ok) {
        return {
          content: [{ type: "text", text: `neuroskill error: ${result.error}` }],
          details: { error: result.error }
        };
      }
      return {
        content: [{ type: "text", text: `Labelled: "${params.text}"` }],
        details: { text: params.text, hasContext: !!params.context }
      };
    }
  });
  pi.registerTool({
    name: "neuroskill_run",
    label: "NeuroSkill",
    description: `Run a neuroskill EXG command and return its JSON output.

Available commands and typical args:
  status                             \u2192 full device/session/scores snapshot
  session [index]                    \u2192 session metrics + trends (0=latest)
  sessions                           \u2192 list all recorded sessions
  search-labels <query>              \u2192 semantic search over EXG annotations
  interactive <keyword>              \u2192 4-layer cross-modal graph search
  label <text>                       \u2192 create a timestamped annotation
  search [--k <n>]                   \u2192 ANN EXG-similarity search
  compare                            \u2192 \u26A0 EXPENSIVE (~60 s, heavy compute). Avoid unless the user explicitly asks to compare sessions. Prefer session/sessions for trend questions. Use the prewarm tool first when compare will be needed soon.
  sleep [index]                      \u2192 sleep staging summary
  umap                               \u2192 3D UMAP projection
  listen [--seconds <n>]             \u2192 stream broadcast events
  raw <json>                         \u2192 send arbitrary JSON to the server`,
    parameters: Type4.Object({
      command: Type4.String({ description: "The neuroskill subcommand to run." }),
      args: Type4.Optional(
        Type4.Array(Type4.String(), {
          description: "Additional positional arguments."
        })
      )
    }),
    execute: async (_id, params, _signal, _onUpdate, _ctx) => {
      const args = [params.command, ...params.args ?? []];
      const result = await runNeuroSkill(args);
      if (!result.ok) {
        return {
          content: [{ type: "text", text: `neuroskill error: ${result.error}` }],
          details: { command: params.command, error: result.error }
        };
      }
      const output = result.data !== void 0 ? JSON.stringify(result.data, null, 2) : result.text ?? "";
      return {
        content: [{ type: "text", text: output }],
        details: { command: params.command, args: params.args }
      };
    }
  });
  pi.registerTool({
    name: "prewarm",
    label: "Prewarm Compare Cache",
    description: "Kick off a background `neuroskill compare` run so the result is ready when the user asks to compare sessions. `neuroskill compare` takes ~60 s; calling this early means the cache will be warm by the time it is needed. Safe to call at any time \u2014 it is a no-op if a build is already in flight or the cache is still fresh (< 10 min old). Call this proactively when the user mentions trends, progress, before/after, or comparing sessions.",
    parameters: Type4.Object({}),
    execute: async (_id, _params, _signal, _onUpdate, _ctx) => {
      warmCompareInBackground();
      return {
        content: [{ type: "text", text: "Compare cache warming in background." }],
        details: {}
      };
    }
  });
  let exgEnabled = true;
  let exgOnline = false;
  let exgMetrics = null;
  let exgUpdatedAt = null;
  let exgLastLabel = null;
  let uiTui = null;
  let exgWs = null;
  let exgWsPort = 8375;
  let exgWsReconnectTimer = null;
  let exgPollTimer = null;
  let exgAgoTimer = null;
  let exgPollMs = 1e3;
  function isExgConnected(json) {
    if (!json.ok) return false;
    const notReady = /* @__PURE__ */ new Set(["scanning", "connecting", "disconnected"]);
    const state = json.device?.state;
    return !(typeof state === "string" && notReady.has(state));
  }
  function parseExgMetrics(json) {
    const s = json.scores ?? {};
    const b = s.bands ?? {};
    const num = (v) => typeof v === "number" ? v : void 0;
    return {
      focus: num(s.focus),
      cognitive_load: num(s.cognitive_load),
      relaxation: num(s.relaxation),
      engagement: num(s.engagement),
      drowsiness: num(s.drowsiness),
      mood: num(s.mood),
      hr: num(s.hr),
      bands: {
        rel_delta: num(b.rel_delta),
        rel_theta: num(b.rel_theta),
        rel_alpha: num(b.rel_alpha),
        rel_beta: num(b.rel_beta),
        rel_gamma: num(b.rel_gamma)
      }
    };
  }
  function mergeScoresEvent(ev) {
    const num = (v) => typeof v === "number" ? v : void 0;
    const prev = exgMetrics ?? {};
    exgMetrics = {
      ...prev,
      focus: num(ev.focus) ?? prev.focus,
      relaxation: num(ev.relaxation) ?? prev.relaxation,
      engagement: num(ev.engagement) ?? prev.engagement,
      hr: num(ev.hr) ?? prev.hr,
      bands: {
        rel_delta: num(ev.rel_delta) ?? prev.bands?.rel_delta,
        rel_theta: num(ev.rel_theta) ?? prev.bands?.rel_theta,
        rel_alpha: num(ev.rel_alpha) ?? prev.bands?.rel_alpha,
        rel_beta: num(ev.rel_beta) ?? prev.bands?.rel_beta,
        rel_gamma: num(ev.rel_gamma) ?? prev.bands?.rel_gamma
      }
    };
    exgOnline = true;
    exgUpdatedAt = Date.now();
  }
  function timeAgo(ts) {
    const s = Math.round((Date.now() - ts) / 1e3);
    if (s < 60) return `${s}s ago`;
    if (s < 3600) return `${Math.round(s / 60)}m ago`;
    return `${Math.round(s / 3600)}h ago`;
  }
  function scoreColor(val, higherIsBetter) {
    const norm = higherIsBetter ? val : 1 - val;
    if (norm >= 0.65) return "success";
    if (norm >= 0.35) return "warning";
    return "error";
  }
  function hrColor(bpm) {
    if (bpm >= 55 && bpm <= 90) return "success";
    if (bpm >= 45 && bpm <= 110) return "warning";
    return "error";
  }
  const BAR_FILLED = "\u2588";
  const BAR_EMPTY = "\u2591";
  function bandBar(theme, val, color, barWidth = 10) {
    if (val == null) return theme.fg("dim", BAR_EMPTY.repeat(barWidth));
    const filled = Math.min(barWidth, Math.round(val * barWidth * 3));
    const empty = Math.max(0, barWidth - filled);
    return theme.fg(color, BAR_FILLED.repeat(filled)) + theme.fg("dim", BAR_EMPTY.repeat(empty));
  }
  function sep(theme, width) {
    return theme.fg("dim", "\u2500".repeat(width));
  }
  const BAND_COLORS = {
    delta: "accent",
    // blue   — deep / slow
    theta: "warning",
    // yellow — drowsy / creative
    alpha: "success",
    // green  — relaxed / calm
    beta: "error",
    // red    — active / alert
    gamma: "syntaxType"
    // teal   — high cognition
  };
  function buildHeader(_tui, theme) {
    const hints = [
      ["esc", "stop"],
      ["ctrl+d", "quit"],
      ["shift+tab", "think"],
      ["ctrl+l", "model"],
      ["ctrl+o", "tools"],
      ["/key", "api key"],
      ["/exg", "exg"],
      ["!", "shell"]
    ];
    return {
      invalidate() {
      },
      render(width) {
        const lines = [];
        const logo = theme.fg("accent", "\u25C6") + " " + theme.bold("neuroloop") + theme.fg("dim", ` v${_pkgVersion}`);
        lines.push(truncateToWidth(logo, width));
        const hintStr = hints.map(([k, a]) => theme.fg("dim", "[") + theme.fg("muted", k) + theme.fg("dim", "] ") + theme.fg("dim", a)).join(theme.fg("dim", "  "));
        lines.push(truncateToWidth(" " + hintStr, width));
        lines.push(sep(theme, width));
        return lines;
      }
    };
  }
  function discoverExgPort() {
    return new Promise((resolve) => {
      exec(
        "lsof -nP -iTCP -sTCP:LISTEN 2>/dev/null | grep -i neuroskill | head -1",
        (_, stdout) => {
          const m = stdout.match(/:(\d{4,5})\s/);
          resolve(m ? parseInt(m[1], 10) : 8375);
        }
      );
    });
  }
  function connectExgWs() {
    if (!exgEnabled) return;
    if (exgWs) return;
    const url = `ws://127.0.0.1:${exgWsPort}`;
    let ws;
    try {
      ws = new WS(url);
    } catch {
      scheduleExgReconnect();
      return;
    }
    exgWs = ws;
    ws.on("open", () => {
      ws.send(JSON.stringify({ command: "status" }));
      stopExgPoll();
      exgPollTimer = setInterval(() => {
        if (exgWs?.readyState === WS.OPEN) {
          exgWs.send(JSON.stringify({ command: "status" }));
        }
      }, exgPollMs);
    });
    ws.on("message", (raw) => {
      let msg;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        return;
      }
      const event = msg.event;
      if (event === "scores") {
        mergeScoresEvent(msg);
        uiTui?.requestRender();
        return;
      }
      if (event === "label_created") {
        const text = String(msg.text ?? "");
        const createdAt = Number(msg.created_at ?? Date.now() / 1e3);
        exgLastLabel = { text, createdAt };
        uiTui?.requestRender();
        pi.sendMessage({
          customType: NEUROSKILL_STATUS_TYPE,
          content: `\u2B21 **label** "${text}"`,
          display: true,
          details: void 0
        });
        return;
      }
      if (msg.command === "status") {
        const wasOnline = exgOnline;
        exgOnline = isExgConnected(msg);
        if (exgOnline) {
          exgMetrics = parseExgMetrics(msg);
          exgUpdatedAt = Date.now();
        }
        const recent = msg.labels?.recent;
        if (recent?.[0]) {
          exgLastLabel = { text: recent[0].text, createdAt: recent[0].created_at };
        }
        if (exgOnline !== wasOnline || exgOnline) uiTui?.requestRender();
      }
    });
    ws.on("error", () => {
    });
    ws.on("close", () => {
      stopExgPoll();
      exgWs = null;
      exgOnline = false;
      uiTui?.requestRender();
      scheduleExgReconnect();
    });
  }
  function stopExgPoll() {
    if (exgPollTimer) {
      clearInterval(exgPollTimer);
      exgPollTimer = null;
    }
  }
  function scheduleExgReconnect(delayMs = 5e3) {
    if (exgWsReconnectTimer) return;
    exgWsReconnectTimer = setTimeout(() => {
      exgWsReconnectTimer = null;
      if (exgEnabled) connectExgWs();
    }, delayMs);
  }
  function disconnectExgWs() {
    stopExgPoll();
    if (exgWsReconnectTimer) {
      clearTimeout(exgWsReconnectTimer);
      exgWsReconnectTimer = null;
    }
    if (exgAgoTimer) {
      clearInterval(exgAgoTimer);
      exgAgoTimer = null;
    }
    exgWs?.close();
    exgWs = null;
  }
  pi.on("session_start", (_event, ctx) => {
    ctx.ui.setHeader((tui, theme) => {
      uiTui = tui;
      discoverExgPort().then((port) => {
        exgWsPort = port;
        connectExgWs();
      });
      exgAgoTimer = setInterval(() => tui.requestRender(), 3e4);
      return buildHeader(tui, theme);
    });
    ctx.ui.setFooter((tui, theme, footerData) => {
      uiTui = tui;
      const unsub = footerData.onBranchChange(() => tui.requestRender());
      return {
        dispose: unsub,
        invalidate() {
        },
        render(width) {
          const lines = [];
          if (exgEnabled && exgOnline && exgMetrics) {
            const m = exgMetrics;
            lines.push(sep(theme, width));
            const sc = (label2, val, better) => {
              if (val == null) return "";
              return theme.fg("dim", label2) + " " + theme.fg(scoreColor(val, better === "high"), val.toFixed(2));
            };
            const hrPart = m.hr != null ? theme.fg("dim", "\u2665 ") + theme.fg(hrColor(m.hr), `${Math.round(m.hr)} bpm`) : "";
            const scores = [
              sc("focus", m.focus, "high"),
              sc("cog.load", m.cognitive_load, "low"),
              sc("relax", m.relaxation, "high"),
              sc("engage", m.engagement, "high"),
              sc("drowsy", m.drowsiness, "low"),
              sc("mood", m.mood, "high"),
              hrPart
            ].filter(Boolean).join(theme.fg("dim", "   "));
            lines.push(truncateToWidth(" " + scores, width));
            const b = m.bands ?? {};
            const bar = (label2, val, color) => theme.fg("dim", label2 + " ") + bandBar(theme, val, color);
            const bandParts = [
              bar("\u03B4", b.rel_delta, BAND_COLORS.delta),
              bar("\u03B8", b.rel_theta, BAND_COLORS.theta),
              bar("\u03B1", b.rel_alpha, BAND_COLORS.alpha),
              bar("\u03B2", b.rel_beta, BAND_COLORS.beta),
              bar("\u03B3", b.rel_gamma, BAND_COLORS.gamma)
            ].join("   ");
            const labelStr = exgLastLabel ? theme.fg("dim", `\u2B21 "${exgLastLabel.text}"  ${timeAgo(exgLastLabel.createdAt * 1e3)}`) : "";
            const bandW = visibleWidth(" " + bandParts);
            const labelW = visibleWidth(labelStr);
            const spacer = Math.max(1, width - bandW - labelW);
            lines.push(truncateToWidth(" " + bandParts + " ".repeat(spacer) + labelStr, width));
          }
          const branch = footerData.getGitBranch();
          const left = theme.fg("muted", ctx.cwd) + (branch ? " " + theme.fg("dim", `(${branch})`) : "");
          const dot = exgOnline ? theme.fg("success", "\u25C9") : theme.fg("dim", "\u25CC");
          const ago = exgUpdatedAt ? theme.fg("dim", ` ${timeAgo(exgUpdatedAt)}`) : "";
          const exgPart = exgEnabled ? dot + " " + theme.fg("dim", "EXG") + ago : theme.fg("dim", "\u25CC EXG off");
          const usage = ctx.getContextUsage();
          const ctxPart = usage?.percent != null ? theme.fg("dim", `${usage.percent.toFixed(1)}%/${Math.round(usage.contextWindow / 1e3)}k`) : "";
          const modelPart = ctx.model?.id ? theme.fg("dim", ctx.model.id) : "";
          const right = [exgPart, ctxPart, modelPart].filter(Boolean).join(theme.fg("dim", "  "));
          const gap = Math.max(1, width - visibleWidth(left) - visibleWidth(right));
          lines.push(truncateToWidth(left + " ".repeat(gap) + right, width));
          return lines;
        }
      };
    });
    ctx.ui.setWorkingMessage("\u{1F9E0} thinking\u2026");
  });
  pi.on("session_shutdown", (_event, sessionCtx) => {
    disconnectExgWs();
    sessionCtx.ui.setHeader(void 0);
    sessionCtx.ui.setFooter(void 0);
  });
  pi.on("before_agent_start", () => {
    if (exgEnabled && !exgWs) connectExgWs();
  });
  const KEY_PROVIDERS = [
    { id: "google", displayName: "Google Gemini", envVar: "GEMINI_API_KEY" },
    { id: "anthropic", displayName: "Anthropic (Claude)", envVar: "ANTHROPIC_API_KEY" },
    { id: "openai", displayName: "OpenAI (GPT)", envVar: "OPENAI_API_KEY" },
    { id: "mistral", displayName: "Mistral AI", envVar: "MISTRAL_API_KEY" },
    { id: "groq", displayName: "Groq", envVar: "GROQ_API_KEY" },
    { id: "xai", displayName: "xAI (Grok)", envVar: "XAI_API_KEY" },
    { id: "openrouter", displayName: "OpenRouter", envVar: "OPENROUTER_API_KEY" },
    { id: "cerebras", displayName: "Cerebras", envVar: "CEREBRAS_API_KEY" }
  ];
  pi.registerCommand("key", {
    description: "Manage API provider keys \xB7 /key [list|remove [<provider>]]",
    handler: async (args, handlerCtx) => {
      const authStorage2 = handlerCtx.modelRegistry.authStorage;
      const parts = args.trim().split(/\s+/).filter(Boolean);
      const sub = parts[0]?.toLowerCase() ?? "";
      if (sub === "list") {
        const lines = ["Configured API providers:"];
        for (const p of KEY_PROVIDERS) {
          const stored = authStorage2.has(p.id);
          const envSet = !!process.env[p.envVar];
          const status = stored ? "\u2713 stored" : envSet ? "  (env)" : "  \u2013";
          lines.push(`  ${status}  ${p.displayName}  (id: ${p.id})`);
        }
        const storedAll = authStorage2.list();
        const knownIds = new Set(KEY_PROVIDERS.map((p) => p.id));
        for (const id of storedAll) {
          if (!knownIds.has(id)) lines.push(`  \u2713 stored  ${id}  (custom)`);
        }
        handlerCtx.ui.notify(lines.join("\n"), "info");
        return;
      }
      if (sub === "remove") {
        const targetId = parts[1]?.toLowerCase();
        let providerId;
        if (targetId) {
          providerId = targetId;
        } else {
          const storedIds = authStorage2.list();
          if (!storedIds.length) {
            handlerCtx.ui.notify("No API keys stored \u2014 nothing to remove.", "warning");
            return;
          }
          const choices2 = storedIds.map((id) => {
            const known = KEY_PROVIDERS.find((p) => p.id === id);
            return known ? `${known.displayName} (${id})` : id;
          });
          const choice2 = await handlerCtx.ui.select("Remove API Key", choices2);
          if (!choice2) return;
          const match = choice2.match(/\(([^)]+)\)$/);
          providerId = match ? match[1] : choice2;
        }
        if (!authStorage2.has(providerId)) {
          handlerCtx.ui.notify(`No stored key for provider "${providerId}".`, "warning");
          return;
        }
        authStorage2.remove(providerId);
        handlerCtx.ui.notify(`Removed API key for "${providerId}".`, "info");
        return;
      }
      const choices = KEY_PROVIDERS.map((p) => {
        const configured = authStorage2.has(p.id) || !!process.env[p.envVar];
        const mark = configured ? "\u2713 " : "  ";
        return `${mark}${p.displayName}`;
      });
      const choice = await handlerCtx.ui.select("Select API Provider", choices);
      if (!choice) return;
      const idx = choices.indexOf(choice);
      const provider = KEY_PROVIDERS[idx];
      if (!provider) return;
      const apiKey = await handlerCtx.ui.input(
        `Enter API key for ${provider.displayName}`,
        `Paste your ${provider.envVar} here`
      );
      if (!apiKey?.trim()) {
        handlerCtx.ui.notify("No key entered \u2014 cancelled.", "warning");
        return;
      }
      authStorage2.set(provider.id, { type: "api_key", key: apiKey.trim() });
      handlerCtx.ui.notify(
        `\u2713 API key saved for ${provider.displayName}.
Switch to a ${provider.displayName} model with /model or Ctrl+L.`,
        "info"
      );
    }
  });
  pi.registerCommand("exg", {
    description: "EXG panel \xB7 /exg [on|off|<seconds>|port <n>]",
    handler: async (args, handlerCtx) => {
      const parts = args.trim().toLowerCase().split(/\s+/);
      const arg = parts[0] ?? "";
      if (arg === "off") {
        exgEnabled = false;
        disconnectExgWs();
        exgOnline = false;
        exgMetrics = null;
        uiTui?.requestRender();
        handlerCtx.ui.notify("EXG live panel disabled  (/exg on to re-enable)", "info");
        return;
      }
      if (arg === "on") {
        exgEnabled = true;
        connectExgWs();
        handlerCtx.ui.notify(`EXG live panel enabled  (poll: ${exgPollMs}ms)`, "info");
        return;
      }
      if (arg === "port" && parts[1]) {
        const port = parseInt(parts[1], 10);
        if (isNaN(port) || port < 1 || port > 65535) {
          handlerCtx.ui.notify("Invalid port number", "error");
          return;
        }
        disconnectExgWs();
        exgWsPort = port;
        connectExgWs();
        handlerCtx.ui.notify(`EXG connecting on port ${port}`, "info");
        return;
      }
      const secs = parseFloat(arg);
      if (!isNaN(secs) && secs > 0) {
        exgPollMs = Math.round(secs * 1e3);
        stopExgPoll();
        if (exgWs?.readyState === WS.OPEN) {
          exgPollTimer = setInterval(() => {
            if (exgWs?.readyState === WS.OPEN) exgWs.send(JSON.stringify({ command: "status" }));
          }, exgPollMs);
        }
        handlerCtx.ui.notify(`EXG poll interval set to ${secs}s`, "info");
        return;
      }
      const result = await runNeuroSkill(["status"]);
      if (result.ok && result.text) {
        pi.sendMessage({
          customType: NEUROSKILL_STATUS_TYPE,
          content: `## \u{1F9E0} EXG Snapshot
${result.text}`,
          display: true,
          details: void 0
        });
      } else {
        handlerCtx.ui.notify("NeuroSkill server not reachable", "error");
      }
    }
  });
  pi.registerCommand("neuro", {
    description: "Run a neuroskill subcommand: /neuro <cmd> [args\u2026]",
    handler: async (args, handlerCtx) => {
      const parts = args.trim().split(/\s+/).filter(Boolean);
      if (!parts.length) {
        handlerCtx.ui.notify("Usage: /neuro <subcommand> [args\u2026]", "warning");
        return;
      }
      const result = await runNeuroSkill(parts);
      if (result.ok && result.text) {
        pi.sendMessage({
          customType: NEUROSKILL_STATUS_TYPE,
          content: `## neuroskill ${parts.join(" ")}
\`\`\`
${result.text}
\`\`\``,
          display: true,
          details: void 0
        });
      } else {
        handlerCtx.ui.notify(result.text || "neuroskill command failed", "error");
      }
    }
  });
  pi.registerShortcut("ctrl+shift+e", {
    description: "Show live EXG snapshot in chat",
    handler: async (handlerCtx) => {
      const result = await runNeuroSkill(["status"]);
      if (result.ok && result.text) {
        pi.sendMessage({
          customType: NEUROSKILL_STATUS_TYPE,
          content: `## \u{1F9E0} EXG Snapshot
${result.text}`,
          display: true,
          details: void 0
        });
      } else {
        handlerCtx.ui.notify("NeuroSkill server not reachable", "error");
      }
    }
  });
}

// src/main.ts
process.env.PI_SKIP_VERSION_CHECK = "1";
var MAIN_FILE = fileURLToPath3(import.meta.url);
var SRC_DIR = dirname4(MAIN_FILE);
var NEUROLOOP_DIR2 = join4(SRC_DIR, "..");
var AGENT_DIR2 = join4(homedir3(), ".neuroloop");
var SKILLS_DIR = join4(NEUROLOOP_DIR2, "skills");
var METRICS_MD_PATH = join4(NEUROLOOP_DIR2, "METRICS.md");
var authStorage = AuthStorage.create(join4(AGENT_DIR2, "auth.json"));
var modelRegistry = new ModelRegistry(authStorage, join4(AGENT_DIR2, "models.json"));
var settingsManager = SettingsManager.create(process.cwd(), AGENT_DIR2);
var DEFAULT_OLLAMA_MODEL = "gpt-oss:20b";
function ollamaModelEntry(id, paramSize = "") {
  const bigModel = /\b(70b|72b|110b|180b)\b/i.test(paramSize);
  return {
    id,
    name: paramSize ? `${id} (${paramSize})` : id,
    reasoning: false,
    input: ["text"],
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: bigModel ? 65536 : 32768,
    maxTokens: bigModel ? 16384 : 8192,
    compat: {
      supportsStore: false,
      supportsReasoningEffort: false,
      supportsDeveloperRole: false,
      requiresToolResultName: false,
      supportsStrictMode: false
    }
  };
}
async function registerOllamaModels() {
  const models = [ollamaModelEntry(DEFAULT_OLLAMA_MODEL)];
  const seen = /* @__PURE__ */ new Set([DEFAULT_OLLAMA_MODEL]);
  try {
    const res = await fetch("http://localhost:11434/api/tags", {
      signal: AbortSignal.timeout(3e3)
    });
    if (res.ok) {
      const { models: tags = [] } = await res.json();
      for (const tag of tags) {
        if (!seen.has(tag.name)) {
          models.push(ollamaModelEntry(tag.name, tag.details?.parameter_size ?? ""));
          seen.add(tag.name);
        }
      }
    }
  } catch {
  }
  modelRegistry.registerProvider("ollama", {
    baseUrl: "http://localhost:11434/v1",
    // "OLLAMA_API_KEY" is treated as an env-var name by resolveConfigValue;
    // falls back to the literal string (truthy) so hasAuth("ollama") is always true.
    apiKey: "OLLAMA_API_KEY",
    api: "openai-completions",
    models
  });
}
await registerOllamaModels();
var loadedSkills = [];
var loader = new DefaultResourceLoader({
  cwd: process.cwd(),
  agentDir: AGENT_DIR2,
  settingsManager,
  // Load individual skills from ./skills/<name>/SKILL.md + METRICS.md
  skillsOverride: (base) => {
    const extra = [];
    if (existsSync4(SKILLS_DIR)) {
      for (const entry of readdirSync(SKILLS_DIR, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue;
        const skillFile = join4(SKILLS_DIR, entry.name, "SKILL.md");
        if (!existsSync4(skillFile)) continue;
        const content = readFileSync4(skillFile, "utf8");
        const fmMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
        if (!fmMatch) continue;
        const fm = fmMatch[1];
        const nameMatch = fm.match(/^name:\s*(.+)$/m);
        const descMatch = fm.match(/^description:\s*(.+)$/m);
        if (!nameMatch || !descMatch) continue;
        extra.push({
          name: nameMatch[1].trim(),
          description: descMatch[1].trim(),
          // Package-relative path: "neuroloop/skills/…/SKILL.md"
          // Consistent regardless of cwd or where npm installed the package.
          filePath: `${basename(NEUROLOOP_DIR2)}/${relative(NEUROLOOP_DIR2, skillFile)}`,
          baseDir: join4(SKILLS_DIR, entry.name),
          source: "path",
          disableModelInvocation: false
        });
      }
    }
    if (existsSync4(METRICS_MD_PATH)) {
      extra.push({
        name: "neuroskill-metrics",
        description: "NeuroSkill EXG metrics reference \u2014 all indices, band powers, scores, and their scientific basis.",
        filePath: `${basename(NEUROLOOP_DIR2)}/${relative(NEUROLOOP_DIR2, METRICS_MD_PATH)}`,
        baseDir: NEUROLOOP_DIR2,
        source: "path",
        disableModelInvocation: false
      });
    }
    loadedSkills = [...base.skills, ...extra];
    return { skills: loadedSkills, diagnostics: base.diagnostics };
  },
  // Brief context note (doesn't duplicate the skills above).
  agentsFilesOverride: (base) => {
    const note = [
      "# NeuroLoop Agent",
      "",
      "EXG-aware coding agent. A live neuroskill status snapshot is injected as an",
      "assistant message before every turn. Use the `neuroskill_run` tool to query",
      "any other neuroskill command.",
      "",
      `Skills dir: ${SKILLS_DIR}`,
      `METRICS.md: ${METRICS_MD_PATH}`
    ].join("\n");
    return {
      agentsFiles: [
        ...base.agentsFiles,
        { path: `${basename(NEUROLOOP_DIR2)}/NEUROLOOP.md`, content: note }
      ]
    };
  },
  // Extension factory: neuroskill status hook + custom tools
  extensionFactories: [neuroloopExtension]
});
await loader.reload();
var { session, modelFallbackMessage } = await createAgentSession({
  cwd: process.cwd(),
  agentDir: AGENT_DIR2,
  authStorage,
  modelRegistry,
  resourceLoader: loader,
  sessionManager: SessionManager.create(process.cwd(), join4(AGENT_DIR2, "sessions")),
  settingsManager
  // No explicit model — let findInitialModel choose:
  //   built-in providers win if they have API keys / OAuth tokens,
  //   otherwise the first Ollama model (gpt-oss:20b) is used.
});
var mode = new InteractiveMode(session, {
  modelFallbackMessage,
  initialMessage: process.argv[2]
});
await mode.run();
console.log(`
Skills loaded (${loadedSkills.length}):`);
for (const skill of loadedSkills) {
  console.log(`  ${skill.name}`);
}
//# sourceMappingURL=neuroloop.js.map
