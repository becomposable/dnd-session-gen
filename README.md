# LLM-powered Dungeon & Dragons Session Generator & Simulator

## Description

This project is a simple dungeon & dragons session generator and simulator.
It is a simple project that is used to demonstrate the power of the [Composable](https://becomposable.com) platform and LLMs.

## Pre-requisites

To run this project, we will use bun, but you can also use node.
This assumes you have bun installed.

```bash
$ curl -fsSL https://bun.sh/install | bash
```

or

```bash
$ npm i -g bun
```

You will also need a Composable API Key, and a project with the following interactions: `DungeonsAndDragonsSessionSummarizer`, `DungeonsAndDragonsSessionPlanner`.

You then need to set the following environment variables (can go into `.env`):
```bash
STUDIO_URL=https://studio-server-preview-33ykyezjaa-uc.a.run.app
STORE_URL=https://zeno-server-preview-33ykyezjaa-uc.a.run.app
COMPOSABLE_KEY=<sk-...>
PROJECT_ID=<project-id>
```

## Installation

To install the project, you can simply clone the repository and install the dependencies using the following commands:

```bash
$ git clone https://github.com/becomposable/dnd-session-generator
$ cd dnd-session-generator
$ bun install #or npm i
```

## Usage

To run the project, you can simply run the following command:

```bash
$ bun run index.ts -h
Usage: index [options] [command]

Options:
  -e, --environment [environmentId]  Environment ID to use for the interaction
  -m, --model [modelId]              Model ID to use for the interaction
  -h, --help                         display help for command

Commands:
  generate                           Generate a new campaign or session (-h for help)
  simulate [options] <campaignId>
  read <campaignId>
  help [command]                     display help for command
```


```bash
$ bun run index.ts generate -h
Usage: index generate [options] [command]

Generate new sessions either for an existing campaign or a new one

Options:
  -h, --help                      display help for command

Commands:
  campaign [options]              Create a session 0 for a new campaign
  session [options] <campaignId>  Create a new session for the campaign
  help [command]                  display help for command
```

### Generate a new campaign

To generate a new campaign, you can run the following command:

```bash
$ bun run index.ts generate campaign \
    --theme "The Shattered Realms: A world of floating islands suspended in a vast sky, connected by magical bridges and airships. Each realm has its unique ecosystem and culture, with the space between filled with swirling mists and strange creatures."
    --size 6
    --level 3
```

Theme, size, and level are optional.

### Generate a new session

To generate a new session, you can run the following command:

```bash
$ bun run index.ts generate session <campaignId> \
-o "Investigate why fire elementals are encroaching on a water-dominated region" \
-o "Retrieve a powerful artifact from a rival faction" \
-o "Defend a village from a dragon attack"
```

Objectives are optional, and you can add as many as you want.


### Simulate play sessions

You can simulate a play by choosing a campaign and a number of turns. The simulator will play all unplayed session plans and generate new plans if needed.

```bash
$ bun run index.ts simulate <campaignId> --turns 10
```

### Read a campaign

You can read a campaign to see its details and the sessions that have been planned.

```bash
$ bun run index.ts read <campaignId>
```


## Notes

All objects are stored into the Composable Content Store, and vector indexed. You can browse on https://cloud.becomposable.com to see the objects and their embeddings.
