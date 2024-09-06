import { ComposableClient } from "@becomposable/client";
import type { ContentObject, ContentObjectType } from "@becomposable/common";
import { Command } from "commander";
import fs from "fs";
import dotenv from "dotenv";

dotenv.config();

const PLAN_TYPE_NAME = "D&D Session Plan";
const SESSION_TYPE_NAME = "D&D Session Summary";
let COMPOSABLE: ComposableClient;
let planType: ContentObjectType;
let sessionType: ContentObjectType;


interface BaseOptions {
    model?: string;
    environment?: string;
}

interface SessionOptions extends BaseOptions {
    objectives?: string[];
    level?: number;
    size?: number;
    theme?: string;
}


async function getClient() {

    if (COMPOSABLE) {
        return COMPOSABLE
    }

    const { STUDIO_URL, STORE_URL, COMPOSABLE_KEY, PROJECT_ID } = process.env;

    if (!STUDIO_URL || !STORE_URL) {
        throw new Error("Missing required environment variables");
    }

    const client = new ComposableClient({
        serverUrl: STUDIO_URL,
        storeUrl: STORE_URL,
        apikey: COMPOSABLE_KEY,
        projectId: PROJECT_ID,
    });

    //exchange api key for token
    const token = await client.getAuthToken();
    client.withApiKey(token.token)

    const [p, s] = await Promise.all([
        client.types.getTypeByName(PLAN_TYPE_NAME),
        client.types.getTypeByName(SESSION_TYPE_NAME)
    ]);
    planType = p;
    sessionType = s;

    COMPOSABLE = client;
    return client;

}

async function simulatePlay(campaignId: string, turns: number, options: SessionOptions) {

    const { unplayedPlans } = await getPreviousPlansAndSessions(campaignId);

    const getNextPlan = async (): Promise<ContentObject<any>> => {
        if (unplayedPlans?.length) {
            const plan = unplayedPlans.shift();
            if (plan) return plan;
        }

        const plan = await planSession(campaignId, options);
        return plan;
    }

    for (const i of Array(turns).keys()) {

        const plan = await getNextPlan();
        console.log(`\nPlaying turn ${i + 1} with plan ${plan.name}`)
        const play = await playGame(plan, options);
        console.log(`\nSession ${i + 1} summary: ${play.name}`, play.properties.summary);
    }
}

async function getPreviousPlansAndSessions(campaignId: string) {
    const composable = await getClient();

    if (!campaignId) {
        throw new Error("Campaign ID not provided");
    }

    if (!planType || !sessionType) {
        throw new Error("Type D&D Session Plan or D&D Session not found");
    }


    const previousSessions = await composable.objects.find({
        query: {
            type: sessionType.id,
            "properties.campaignId": campaignId,
        },
    });

    console.log(`Found ${previousSessions.length} previous sessions for campaign ${campaignId}`)

    const previousPlans = await composable.objects.find({
        query: {
            type: planType.id,
            "properties.campaignId": campaignId,
        },
    });

    previousPlans.sort(p => p.properties.sessionNumber)
    previousSessions.sort(s => s.properties.sessionNumber)

    console.log(`Found ${previousPlans.length} previous plans for campaign ${campaignId}`);

    const unplayedPlans = previousPlans.filter(p => !previousSessions.some(s => s.properties.sessionNumber === p.properties.sessionNumber))
    console.log(`Found ${unplayedPlans.length} unplayed plans for campaign ${campaignId}: ${unplayedPlans.map(p => p.properties.title)}`)


    return { previousPlans, previousSessions, unplayedPlans }


}

async function planSession(campaignId?: string, options?: SessionOptions) {
    console.log("\nGenerating Dungeon Master plan for D&D new session...");

    const { objectives, level, size, theme, model, environment } = options ?? {};
    const composable = await getClient();

    const { previousPlans, previousSessions } = campaignId ? await getPreviousPlansAndSessions(campaignId) : { previousPlans: [], previousSessions: [] }

    if (!planType || !sessionType) {
        throw new Error("Type D&D Session Plan or D&D Session not found");
    }

    const sessionNumber = previousPlans.length ? previousPlans.length + 1 : 0;
    const sessionGuide = sessionNumber
        ? "store:66d97ce8ca04fdf05f1a1161"
        : "store:66d97ce0ca04fdf05f1a1151"; //could be replaced by a query


    console.log(`\nPlanning session ${sessionNumber} for campaign ${campaignId}...`, options);
    const res = await composable.interactions.executeByName(
        "DungeonsAndDragonsSessionPlanner",
        {
            data: {
                partyInfo: {
                    level: level ?? 1,
                    size: size ?? 4,
                    classes: ["Paladin", "Wizard", "Rogue", "Cleric", "Druid"],
                },
                sessionNumber: sessionNumber,
                sessionGuide: sessionGuide,
                campaignSetting: theme,
                previousSessionsSummaries: previousSessions.map((s: any) => s.properties),
                previousPlans: previousPlans.map((p: any) => p.properties),
                currentObjectives: objectives
            },
            result_schema: planType.object_schema,
            config: {
                environment,
                model
            },
        },
    );

    console.log("Saving Session Plan...");
    const plan = await composable.objects.create({
        type: planType.id,
        properties: res.result,
        name: `[${res.result.campaignId}] ${res.result.title}`
    });
    console.log("Session Plan saved: ", plan.id);

    console.log(plan);
    return plan;
}

async function playGame(plan: ContentObject<any>, options?: BaseOptions) {
    console.log("\nPlaying D&D session...");
    const composable = await getClient();
    const { model, environment } = options ?? {};

    let play = await composable.interactions.executeByName(
        "DungeonsAndDragonsSessionSummarizer",
        {
            data: {
                sessionPlan: plan.properties,
            },
            result_schema: sessionType.object_schema,
            config: {
                environment,
                model
            },
        },
    );

    console.log(`Summary of play for ${plan.properties.sessionNumber} of ${plan.properties.campainId}:`)
    console.log("\n" + play.result.summary);

    const sess = await composable.objects.create({
        type: sessionType.id,
        parent: plan.id,
        name: `[${plan.properties.campaignId}] Session ${plan.properties.sessionNumber}`,
        properties: {
            campaignId: plan.properties.campaignId,
            sessionNumber: plan.properties.sessionNumber,
            summary: play.result.summary,
        },
        text: play.result.summary,
    });

    console.log("Session summary saved!", sess.id)

    return sess;

}


async function readSessions(campaignId: string) {
    const composable = await getClient();
    const sessions = await composable.objects.find({
        query: {
            type: sessionType.id,
            "properties.campaignId": campaignId,
        },
    });

    console.log(`Found ${sessions.length} sessions for campaign ${campaignId}\n`);
    sessions?.forEach(session => {
        console.log(`\n\n${session.name}:`);
        console.log(session.properties.summary);
    })
}

const program = new Command()
    .option(
        "-e, --environment [environmentId]",
        "Environment ID to use for the interaction",
    )
    .option("-m, --model [modelId]", "Model ID to use for the interaction");

const generate = program
    .command("generate")
    .description(
        "Generate new sessions either for an existing campaign or a new one",
    )

generate
    .command("campaign")
    .description("Create a session 0 for a new campaign")
    .option("-t, --theme [theme]", "Set the theme of the campaign")
    .option("-l, --level [level]", "Set the level of the party")
    .option("-s, --size [size]", "Set the size of the party")
    .action(async (options) => {
        console.log("Creating a new game...");
        let game = planSession(undefined, options);
    });

generate
    .command("session <campaignId>")
    .description("Create a new session for the campaign")
    .option("-o, --objective [objectives...]", "Add objectives to the game")
    .action(async (campaignId: string, options: any) => {
        console.log("Creating a new session...", options);
        await planSession(campaignId, options);
    });

const simulate = program.command("simulate <campaignId>");
simulate
    .option("-T, --turns <turns>", "Number of turns to simulate", parseInt)
    .action(async (campaignId: string, options) => {
        console.log("Simulating game...");
        await simulatePlay(campaignId, options.turns, options);
    });


program.command("read <campaignId>").action(async (campaignId: string) => {
    console.log(`Reading sessions for ${campaignId}...`);
    await readSessions(campaignId);
});

program.parse(process.argv);
