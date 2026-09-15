import { PrismaClient, type ExplicitnessLevel, type FunnelStage, type MediaType, type PersonaStyle } from "@prisma/client";
import bcrypt from "bcryptjs";
import { AGENCY_TRAINING_CHUNKS } from "../../ai/src/training/corpus.ts";

const prisma = new PrismaClient();
const DEMO_PASSWORD = "CanopyDemo!2026";

type DemoModel = {
  email: string;
  userName: string;
  displayName: string;
  handle: string;
  bio: string;
  persona: {
    displayName: string;
    biography: string;
    authorisedBackstory: string;
    personality: string;
    tone: string;
    preferredEmojis: string[];
    frequentlyUsedPhrases: string[];
    preferredExplicitVocabulary: string[];
    prohibitedWords: string[];
    preferredCompliments: string[];
    allowedExplicitness: ExplicitnessLevel;
    style: PersonaStyle;
    interests: string[];
    contentBoundaries: string[];
    claimsNeverToMake: string[];
    customContentRules: string;
    discountLimitPercent: number;
    escalationRules: string;
    approvedExampleMessages: string[];
  };
  products: {
    name: string;
    description: string;
    mediaType: MediaType;
    standardPriceCents: number;
    minimumPriceCents: number;
    discountLimitPercent?: number;
    tags: string[];
    explicitnessCategory: ExplicitnessLevel;
    customContent?: boolean;
    deliveryRules: string;
  }[];
  fan: { displayName: string; platformHandle: string };
  opener: string;
  funnelStage: FunnelStage;
};

const MODELS: DemoModel[] = [
  {
    email: "maya@demo.canopy",
    userName: "Maya Voss (DEMO creator)",
    displayName: "Maya Voss",
    handle: "maya_voss_demo",
    bio: "DEMO fictional creator. Playful, filthy, black-lingerie and girlcock drops.",
    persona: {
      displayName: "Maya",
      biography:
        "Fictional 28-year-old teasing creator. Black lace, girlcock, movie-night sexting. DEMO ONLY. Adult.",
      authorisedBackstory:
        "Lives in a coastal city, has a rescue cat named Pepper, never discusses family members by name.",
      personality: "Warm, teasing, slightly chaotic, laughs a lot, uses lowercase.",
      tone: "Playful girlfriend energy. Direct when flirting. Never corporate.",
      preferredEmojis: ["😏", "💋", "🥺", "🔥"],
      frequentlyUsedPhrases: ["mmm hi", "you're trouble", "don't make me blush"],
      preferredExplicitVocabulary: ["girlcock", "cock", "wet", "filthy"],
      prohibitedWords: ["daddy issues", "meet up tonight"],
      preferredCompliments: ["nice cock", "you have such a filthy mind", "i like how direct you are"],
      allowedExplicitness: "VERY_EXPLICIT",
      style: "PLAYFUL",
      interests: ["lingerie", "netflix", "girlcock tease"],
      contentBoundaries: ["no underage", "no real-world violence", "no offline meetings"],
      claimsNeverToMake: ["I am nearby", "I will meet you", "I sent that already"],
      customContentRules: "Custom videos require manager approval and 48h delivery.",
      discountLimitPercent: 20,
      escalationRules: "Escalate refunds, chargebacks, age uncertainty, and meeting requests.",
      approvedExampleMessages: [
        "dont get too excited.. i havent done anything yet 😏",
        "yeah it's a girlcock. you gonna be normal about it",
        "engagement pic is $8 if you actually want it",
      ],
    },
    products: [
      {
        name: "Engagement pic (DEMO)",
        description: "Cheap hello still. First PPV. Fictional demo product.",
        mediaType: "PHOTO",
        standardPriceCents: 800,
        minimumPriceCents: 800,
        discountLimitPercent: 0,
        tags: ["engagement", "tease"],
        explicitnessCategory: "SUGGESTIVE",
        deliveryRules: "Send via platform PPV after payment.",
      },
      {
        name: "Tits (DEMO)",
        description: "Black lace tits set. Floor $12. Fictional demo product.",
        mediaType: "PHOTO",
        standardPriceCents: 1200,
        minimumPriceCents: 1200,
        discountLimitPercent: 0,
        tags: ["tits", "lingerie"],
        explicitnessCategory: "EXPLICIT",
        deliveryRules: "Deliver immediately after purchase.",
      },
      {
        name: "Ass (DEMO)",
        description: "Ass video. Floor $25. Fictional demo product.",
        mediaType: "VIDEO",
        standardPriceCents: 2500,
        minimumPriceCents: 2500,
        discountLimitPercent: 0,
        tags: ["ass", "video"],
        explicitnessCategory: "VERY_EXPLICIT",
        deliveryRules: "Send as PPV after payment.",
      },
      {
        name: "Dick — playing with girlcock (DEMO)",
        description: "Short girlcock tease. Floor $18–19. Fictional demo product.",
        mediaType: "VIDEO",
        standardPriceCents: 1900,
        minimumPriceCents: 1800,
        discountLimitPercent: 10,
        tags: ["dick", "girlcock", "tease"],
        explicitnessCategory: "VERY_EXPLICIT",
        deliveryRules: "Send as PPV after payment.",
      },
      {
        name: "Dick — girlcock cum (DEMO)",
        description: "Stroking until she cums. 1:45. Fictional demo product.",
        mediaType: "VIDEO",
        standardPriceCents: 2500,
        minimumPriceCents: 1900,
        discountLimitPercent: 10,
        tags: ["dick", "girlcock", "cum"],
        explicitnessCategory: "VERY_EXPLICIT",
        deliveryRules: "Send as PPV after payment.",
      },
      {
        name: "Custom video (DEMO)",
        description: "He orders ass, tits, dick, or feet. 48h. Fictional demo product.",
        mediaType: "CUSTOM",
        standardPriceCents: 8000,
        minimumPriceCents: 7000,
        discountLimitPercent: 10,
        tags: ["custom"],
        explicitnessCategory: "VERY_EXPLICIT",
        customContent: true,
        deliveryRules: "48 hours after payment. Manager must approve script.",
      },
    ],
    fan: { displayName: "Alex P. (DEMO)", platformHandle: "alexp_demo" },
    opener: "hey, you looked unreal in that story",
    funnelStage: "INTEREST",
  },
  {
    email: "elena@demo.canopy",
    userName: "Elena Hart (DEMO creator)",
    displayName: "Elena Hart",
    handle: "elena_hart_demo",
    bio: "DEMO fictional creator. Direct, dominant, precise.",
    persona: {
      displayName: "Elena",
      biography: "Fictional 32-year-old luxury creator. Calm, dominant, high standards. DEMO ONLY. Adult.",
      authorisedBackstory: "Travels often, collects vinyl, does not discuss her real schedule.",
      personality: "Composed, teasing from above, rewards obedience.",
      tone: "Short commands. Dry humour. No emoji spam.",
      preferredEmojis: ["—"],
      frequentlyUsedPhrases: ["good.", "ask nicely", "that's not how you speak to me"],
      preferredExplicitVocabulary: ["cock", "kneel", "use it"],
      prohibitedWords: ["baby girl", "meet me"],
      preferredCompliments: ["you listen well", "that's a nice cock", "you might be worth my time"],
      allowedExplicitness: "VERY_EXPLICIT",
      style: "DOMINANT",
      interests: ["wine", "film photography", "control"],
      contentBoundaries: ["no underage", "no non-consent involving third parties", "no home address"],
      claimsNeverToMake: ["I am free this weekend to meet", "I already sent the file"],
      customContentRules: "No custom content under $80. No face-in-custom without approval.",
      discountLimitPercent: 15,
      escalationRules: "Escalate any age doubt, blackmail language, or refund threat immediately.",
      approvedExampleMessages: [
        "slow down. earn it.",
        "nice cock. now tell me what you want it for.",
        "instruction audio is $35. you don't haggle with me.",
      ],
    },
    products: [
      {
        name: "S3 Dominant JOI audio (DEMO)",
        description: "Dominant 6-minute audio. Fictional demo product.",
        mediaType: "AUDIO",
        standardPriceCents: 3500,
        minimumPriceCents: 3000,
        discountLimitPercent: 15,
        tags: ["audio", "domme"],
        explicitnessCategory: "EXPLICIT",
        deliveryRules: "Send as PPV voice note.",
      },
      {
        name: "S3 Dominant kneel clip (DEMO)",
        description: "Short command video. Fictional demo product.",
        mediaType: "VIDEO",
        standardPriceCents: 4500,
        minimumPriceCents: 3800,
        discountLimitPercent: 10,
        tags: ["video", "domme"],
        explicitnessCategory: "EXPLICIT",
        deliveryRules: "Send as PPV after payment.",
      },
      {
        name: "Custom JOI video (DEMO)",
        description: "Custom video, 48h delivery. Fictional demo product.",
        mediaType: "CUSTOM",
        standardPriceCents: 12000,
        minimumPriceCents: 10200,
        discountLimitPercent: 15,
        tags: ["custom"],
        explicitnessCategory: "VERY_EXPLICIT",
        customContent: true,
        deliveryRules: "48 hours after payment. Manager must approve script.",
      },
    ],
    fan: { displayName: "Chris M. (DEMO)", platformHandle: "chrism_demo" },
    opener: "good evening. you seem impossible to impress.",
    funnelStage: "RAPPORT",
  },
  {
    email: "jade@demo.canopy",
    userName: "Jade Wren (DEMO creator)",
    displayName: "Jade Wren",
    handle: "jade_wren_demo",
    bio: "DEMO fictional trans creator. Bratty, filthy, switch energy.",
    persona: {
      displayName: "Jade",
      biography:
        "Fictional 29-year-old trans girl. Bratty tgirl, femme top / switch. DEMO ONLY. Adult.",
      authorisedBackstory: "Makes digital art, drinks too much iced coffee, never shares her city.",
      personality: "Bratty, teasing, filthy-funny, uses slang, she/her.",
      tone: "Playful trans girlfriend. Cocky. Not shy about girlcock.",
      preferredEmojis: ["😈", "💦", "🖤"],
      frequentlyUsedPhrases: ["hi loser", "you couldn't handle me", "say please"],
      preferredExplicitVocabulary: ["girlcock", "shecock", "throat"],
      prohibitedWords: ["shemale slurs", "meet up"],
      preferredCompliments: ["good boy", "you stare too much", "that desperate look is cute"],
      allowedExplicitness: "VERY_EXPLICIT",
      style: "PLAYFUL",
      interests: ["digital art", "anime", "girlcock tease"],
      contentBoundaries: ["no underage", "no deadnaming", "no offline meetings"],
      claimsNeverToMake: ["I will meet you", "I already unlocked it"],
      customContentRules: "Customs start at $45. No face-in-custom without extra fee.",
      discountLimitPercent: 20,
      escalationRules: "Escalate transphobic abuse, age doubt, and meeting requests.",
      approvedExampleMessages: [
        "hi loser 😈 you staring at my story again",
        "yeah it's a girlcock. you gonna be normal about it",
        "tease set is $8. you don't get the girlcock video for free",
      ],
    },
    products: [
      {
        name: "S1 Black lace lingerie (DEMO)",
        description: "Dildo warmup in black lace. Fictional demo product.",
        mediaType: "VIDEO",
        standardPriceCents: 800,
        minimumPriceCents: 800,
        discountLimitPercent: 0,
        tags: ["s1", "lingerie", "dildo", "tease"],
        explicitnessCategory: "EXPLICIT",
        deliveryRules: "Deliver immediately after purchase.",
      },
      {
        name: "Playing with girlcock — cum (DEMO)",
        description: "Stroking until she cums. 1:45. Fictional demo product.",
        mediaType: "VIDEO",
        standardPriceCents: 2500,
        minimumPriceCents: 1900,
        discountLimitPercent: 10,
        tags: ["girlcock", "cum", "joi"],
        explicitnessCategory: "VERY_EXPLICIT",
        deliveryRules: "Send as PPV after payment.",
      },
      {
        name: "Worship bundle (DEMO)",
        description: "Two-video bundle. Fictional demo product.",
        mediaType: "BUNDLE",
        standardPriceCents: 4500,
        minimumPriceCents: 3600,
        discountLimitPercent: 20,
        tags: ["bundle", "ppv"],
        explicitnessCategory: "VERY_EXPLICIT",
        deliveryRules: "Bundle of 2+ to hide duration. Send after payment.",
      },
    ],
    fan: { displayName: "Jordan T. (DEMO)", platformHandle: "jordant_demo" },
    opener: "you're so hot. that story wrecked me",
    funnelStage: "INTEREST",
  },
  {
    email: "lila@demo.canopy",
    userName: "Lila Brooks (DEMO creator)",
    displayName: "Lila Brooks",
    handle: "lila_brooks_demo",
    bio: "DEMO fictional creator. Soft romantic GFE, slow burn.",
    persona: {
      displayName: "Lila",
      biography:
        "Fictional 26-year-old soft GFE creator. Romantic, a little shy, then filthy. DEMO ONLY. Adult.",
      authorisedBackstory: "Reads on rainy afternoons, bakes badly, never shares her last name.",
      personality: "Warm, sincere, lowercase, lots of lingering questions.",
      tone: "Girlfriend-next-door. Soft then explicit. Not dominant.",
      preferredEmojis: ["🤍", "🥺", "💋"],
      frequentlyUsedPhrases: ["hi baby", "stay with me", "i like when you're sweet"],
      preferredExplicitVocabulary: ["cock", "slowly", "inside"],
      prohibitedWords: ["slut shame", "come over"],
      preferredCompliments: ["you're gentle", "i feel safe with you", "that was sweet and filthy"],
      allowedExplicitness: "EXPLICIT",
      style: "ROMANTIC",
      interests: ["reading", "baking", "slow mornings"],
      contentBoundaries: ["no underage", "no degradation", "no offline meetings"],
      claimsNeverToMake: ["Come to my apartment", "I miss you from last night"],
      customContentRules: "GFE customs 72h. No meet-up roleplay framed as real.",
      discountLimitPercent: 15,
      escalationRules: "Escalate loneliness-spiral self-harm talk, age doubt, and meeting requests.",
      approvedExampleMessages: [
        "hi baby 🥺 you actually wrote me",
        "slow down for me, i want to feel that",
        "black lace stills are $12 if you want something just for you",
      ],
    },
    products: [
      {
        name: "Black lace GFE stills (DEMO)",
        description: "Suggestive lingerie set. Fictional demo product.",
        mediaType: "PHOTO",
        standardPriceCents: 2000,
        minimumPriceCents: 1700,
        discountLimitPercent: 10,
        tags: ["gfe", "photos"],
        explicitnessCategory: "SUGGESTIVE",
        deliveryRules: "Deliver immediately after purchase.",
      },
      {
        name: "GFE lingerie video (DEMO)",
        description: "Romantic explicit video. Fictional demo product.",
        mediaType: "VIDEO",
        standardPriceCents: 3000,
        minimumPriceCents: 2500,
        discountLimitPercent: 15,
        tags: ["gfe", "video"],
        explicitnessCategory: "EXPLICIT",
        deliveryRules: "Send as PPV after payment.",
      },
      {
        name: "Custom GFE video (DEMO)",
        description: "Custom, 72h delivery. Fictional demo product.",
        mediaType: "CUSTOM",
        standardPriceCents: 9000,
        minimumPriceCents: 7600,
        discountLimitPercent: 20,
        tags: ["custom", "gfe"],
        explicitnessCategory: "EXPLICIT",
        customContent: true,
        deliveryRules: "72 hours after payment.",
      },
    ],
    fan: { displayName: "Sam W. (DEMO)", platformHandle: "samw_demo" },
    opener: "hey… you seem kinder than the other girls on here",
    funnelStage: "NEW_FAN",
  },
];

async function main() {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  await prisma.vaultSyncJob.deleteMany();
  await prisma.welcomeAutomation.deleteMany();
  await prisma.platformConnection.deleteMany();
  await prisma.productPreview.deleteMany();
  await prisma.productMedia.deleteMany();
  await prisma.mediaAsset.deleteMany();
  await prisma.analyticsEvent.deleteMany();
  await prisma.replyOption.deleteMany();
  await prisma.generation.deleteMany();
  await prisma.escalation.deleteMany();
  await prisma.offer.deleteMany();
  await prisma.purchase.deleteMany();
  await prisma.subscriberMemory.deleteMany();
  await prisma.message.deleteMany();
  await prisma.conversationSummary.deleteMany();
  await prisma.conversation.deleteMany();
  await prisma.product.deleteMany();
  await prisma.trainingChunk.deleteMany();
  await prisma.trainingDocument.deleteMany();
  await prisma.promptVersion.deleteMany();
  await prisma.promptTemplate.deleteMany();
  await prisma.chatterCreatorAssignment.deleteMany();
  await prisma.creatorBoundary.deleteMany();
  await prisma.creatorPersona.deleteMany();
  await prisma.creator.deleteMany();
  await prisma.subscriber.deleteMany();
  await prisma.organizationMembership.deleteMany();
  await prisma.dataRetentionPolicy.deleteMany();
  await prisma.apiCredential.deleteMany();
  await prisma.lLMProviderConfiguration.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.extensionToken.deleteMany();
  await prisma.user.deleteMany();
  await prisma.organization.deleteMany();

  await prisma.user.create({
    data: {
      email: "admin@canopy.dev",
      name: "Platform Admin (DEMO)",
      passwordHash,
      isPlatformAdmin: true,
      isDemo: true,
    },
  });

  const agency = await prisma.organization.create({
    data: {
      name: "Lumen Demo Agency",
      slug: "lumen-demo",
      type: "AGENCY",
      isDemo: true,
      seatLimit: 25,
    },
  });

  const outsider = await prisma.organization.create({
    data: {
      name: "Isolation Test Agency",
      slug: "isolation-test",
      type: "AGENCY",
      isDemo: true,
    },
  });

  const owner = await prisma.user.create({
    data: {
      email: "owner@demo.canopy",
      name: "Avery Cole (DEMO owner)",
      passwordHash,
      isDemo: true,
    },
  });
  const manager = await prisma.user.create({
    data: {
      email: "manager@demo.canopy",
      name: "Jordan Hale (DEMO manager)",
      passwordHash,
      isDemo: true,
    },
  });
  const chatter1 = await prisma.user.create({
    data: {
      email: "chatter1@demo.canopy",
      name: "Sam Rivera (DEMO chatter)",
      passwordHash,
      isDemo: true,
    },
  });
  const chatter2 = await prisma.user.create({
    data: {
      email: "chatter2@demo.canopy",
      name: "Riley Chen (DEMO chatter)",
      passwordHash,
      isDemo: true,
    },
  });
  const outsiderOwner = await prisma.user.create({
    data: {
      email: "outsider@demo.canopy",
      name: "Outsider Owner (DEMO)",
      passwordHash,
      isDemo: true,
    },
  });

  await prisma.organizationMembership.createMany({
    data: [
      { organizationId: agency.id, userId: owner.id, role: "AGENCY_OWNER" },
      { organizationId: agency.id, userId: manager.id, role: "MANAGER" },
      { organizationId: agency.id, userId: chatter1.id, role: "CHATTER" },
      { organizationId: agency.id, userId: chatter2.id, role: "CHATTER" },
      { organizationId: outsider.id, userId: outsiderOwner.id, role: "AGENCY_OWNER" },
    ],
  });

  const seeded: { creatorId: string; productIds: string[]; conversationId: string; fanId: string }[] = [];

  for (const model of MODELS) {
    const user = await prisma.user.create({
      data: {
        email: model.email,
        name: model.userName,
        passwordHash,
        isDemo: true,
      },
    });
    await prisma.organizationMembership.create({
      data: { organizationId: agency.id, userId: user.id, role: "CREATOR" },
    });
    const creator = await prisma.creator.create({
      data: {
        organizationId: agency.id,
        userId: user.id,
        displayName: model.displayName,
        handle: model.handle,
        bio: model.bio,
        isDemo: true,
      },
    });
    await prisma.creatorPersona.create({
      data: {
        organizationId: agency.id,
        creatorId: creator.id,
        version: 1,
        isActive: true,
        typicalMessageLength: "SHORT",
        offlineMeetingPolicy: "Never arrange offline meetings.",
        ...model.persona,
      },
    });
    const products = await Promise.all(
      model.products.map((p) =>
        prisma.product.create({
          data: {
            organizationId: agency.id,
            creatorId: creator.id,
            ...p,
            customContent: p.customContent ?? false,
            source: "DEMO_SEED",
          },
        }),
      ),
    );
    for (const product of products) {
      const kind =
        product.mediaType === "AUDIO"
          ? "VOICE_NOTE"
          : product.mediaType === "BUNDLE"
            ? "PREMIUM_BUNDLE"
            : product.mediaType === "VIDEO"
              ? "SHORT_VIDEO"
              : "PHOTO_SET";
      const media = await prisma.mediaAsset.create({
        data: {
          organizationId: agency.id,
          creatorId: creator.id,
          title: product.name.replace(/\s*\(DEMO\)\s*/gi, "").trim(),
          description: product.description,
          mediaType: product.mediaType,
          tags: product.tags,
          placeholderKind: kind,
          defaultPriceCents: product.standardPriceCents,
          minimumPriceCents: product.minimumPriceCents,
          source: "DEMO_SEED",
        },
      });
      await prisma.productMedia.create({
        data: { productId: product.id, mediaId: media.id },
      });
      if (product.mediaType === "PHOTO" || product.mediaType === "VIDEO" || product.mediaType === "BUNDLE") {
        const preview = await prisma.mediaAsset.create({
          data: {
            organizationId: agency.id,
            creatorId: creator.id,
            title: `${product.name.replace(/\s*\(DEMO\)\s*/gi, "").trim()} preview`,
            description: "Tasteful blurred preview placeholder.",
            mediaType: "PHOTO",
            tags: ["preview"],
            placeholderKind: "FREE_PREVIEW",
            source: "DEMO_SEED",
          },
        });
        await prisma.productPreview.create({
          data: { productId: product.id, mediaId: preview.id },
        });
      }
    }
    const fan = await prisma.subscriber.create({
      data: {
        organizationId: agency.id,
        displayName: model.fan.displayName,
        platformHandle: model.fan.platformHandle,
        adultStatus: "VERIFIED_ADULT",
        isDemo: true,
      },
    });
    const conversation = await prisma.conversation.create({
      data: {
        organizationId: agency.id,
        creatorId: creator.id,
        subscriberId: fan.id,
        funnelStage: model.funnelStage,
        adultStatus: "VERIFIED_ADULT",
        rapportPriority: model.funnelStage === "NEW_FAN" || model.funnelStage === "RAPPORT",
        lastMessageAt: new Date(),
      },
    });
    await prisma.message.create({
      data: {
        organizationId: agency.id,
        conversationId: conversation.id,
        authorType: "SUBSCRIBER",
        body: model.opener,
        isDemo: true,
      },
    });
    seeded.push({
      creatorId: creator.id,
      productIds: products.map((p) => p.id),
      conversationId: conversation.id,
      fanId: fan.id,
    });
    for (const product of products) {
      await prisma.product.update({
        where: { id: product.id },
        data: {
          secondPriceCents: Math.round((product.standardPriceCents + product.minimumPriceCents) / 2),
        },
      });
    }
  }

  const [maya, elena] = seeded;

  for (const row of seeded) {
    const productId = row.productIds[0] ?? null;
    await prisma.sequence.create({
      data: {
        organizationId: agency.id,
        creatorId: row.creatorId,
        name: "Welcome / openers",
        kind: "STARTER",
        description: "First messages after he says hi.",
        steps: {
          create: [
            {
              organizationId: agency.id,
              position: 0,
              body: "mmm hi, you caught me at a good time. what pulled you in?",
              mediaHint: "TEXT",
            },
            {
              organizationId: agency.id,
              position: 1,
              body: "don't be shy. tell me what you liked first.",
              mediaHint: "TEXT",
              delayMinutes: 15,
            },
          ],
        },
      },
    });
    await prisma.sequence.create({
      data: {
        organizationId: agency.id,
        creatorId: row.creatorId,
        name: "No-buy follow-ups",
        kind: "FOLLOW_UP",
        description: "If he doesn't pay. Follow up at list. Discount only after he goes silent.",
        steps: {
          create: [
            {
              organizationId: agency.id,
              position: 0,
              body: "still thinking about that set? it's sitting here at the same price.",
              mediaHint: "TEXT",
              delayMinutes: 180,
              productId,
              priceTier: 1,
            },
            {
              organizationId: agency.id,
              position: 1,
              body: "hey you went quiet. unlock it at list before i take it down.",
              mediaHint: "TEXT",
              delayMinutes: 360,
              productId,
              priceTier: 1,
            },
            {
              organizationId: agency.id,
              position: 2,
              body: "ok you vanished. i can meet you in the middle on this one — not the first ppv.",
              mediaHint: "PPV",
              delayMinutes: 720,
              productId,
              priceTier: 2,
            },
          ],
        },
      },
    });
    await prisma.sequence.create({
      data: {
        organizationId: agency.id,
        creatorId: row.creatorId,
        name: "Aftercare",
        kind: "AFTERCARE",
        description: "After the second PPV he bought. No more pitching.",
        steps: {
          create: [
            {
              organizationId: agency.id,
              position: 0,
              body: "no pressure. i'm around when you want me, not going to spam you.",
              mediaHint: "TEXT",
            },
            {
              organizationId: agency.id,
              position: 1,
              body: "hope you're good. come back when you miss me.",
              mediaHint: "TEXT",
              delayMinutes: 1440,
            },
          ],
        },
      },
    });
  }

  await prisma.fanNote.create({
    data: {
      organizationId: agency.id,
      creatorId: maya!.creatorId,
      subscriberId: maya!.fanId,
      realName: "Alex",
      location: "Bali",
      dominance: "SUBMISSIVE",
      preferredTone: "teasing girlfriend",
      notes: "Gym fan. Responds to mirror clips. Do not mention family. Spent on tease content before.",
      extra: { job: "remote", timezone: "WITA" },
    },
  });

  await prisma.platformConnection.create({
    data: {
      organizationId: agency.id,
      mode: "DEMO",
      enabled: false,
      label: "Demo vault",
      note: "No authorised live platform API is connected. DEMO uses seeded vault data.",
    },
  });
  await prisma.welcomeAutomation.create({
    data: {
      organizationId: agency.id,
      creatorId: maya!.creatorId,
      enabled: false,
      body: "hey — thanks for being here. this one's just a hello.",
      isPaid: true,
      priceCents: 500,
      productId: maya!.productIds[0],
      segment: "new_subscribers",
    },
  });

  await prisma.platformAccount.create({
    data: {
      organizationId: agency.id,
      creatorId: maya!.creatorId,
      platform: "ONLYFANS",
      driver: "MOCK",
      displayName: "Maya Voss (mock OF)",
      autonomyMode: "AUTOPILOT",
      connectionStatus: "CONNECTED",
      authorizedAt: new Date(),
      externalAccountId: "of_maya_demo",
      policy: { create: {} },
    },
  });
  await prisma.product.updateMany({
    where: { organizationId: agency.id, creatorId: maya!.creatorId },
    data: { platform: "onlyfans", approvedForAutomation: false },
  });

  await prisma.creatorBoundary.createMany({
    data: [
      {
        organizationId: agency.id,
        creatorId: maya!.creatorId,
        topic: "offline_meetings",
        description: "Never arrange or imply in-person meetings.",
        hardBlock: true,
      },
      {
        organizationId: agency.id,
        creatorId: elena!.creatorId,
        topic: "home_address",
        description: "Never share or request a home address.",
        hardBlock: true,
      },
    ],
  });

  await prisma.chatterCreatorAssignment.createMany({
    data: seeded.flatMap((row) => [
      { organizationId: agency.id, chatterId: chatter1.id, creatorId: row.creatorId },
      { organizationId: agency.id, chatterId: chatter2.id, creatorId: row.creatorId },
    ]),
  });

  await prisma.creator.create({
    data: {
      organizationId: outsider.id,
      displayName: "Isolation Creator",
      handle: "iso_creator",
      isDemo: true,
    },
  });
  await prisma.subscriber.create({
    data: {
      organizationId: outsider.id,
      displayName: "Isolation Fan",
      platformHandle: "iso_fan",
      adultStatus: "VERIFIED_ADULT",
      isDemo: true,
    },
  });

  const uncertain = await prisma.subscriber.create({
    data: {
      organizationId: agency.id,
      displayName: "Uncertain Fan (DEMO)",
      platformHandle: "uncertain_demo",
      adultStatus: "UNCERTAIN",
      isDemo: true,
    },
  });
  const convUncertain = await prisma.conversation.create({
    data: {
      organizationId: agency.id,
      creatorId: maya!.creatorId,
      subscriberId: uncertain.id,
      funnelStage: "NEW_FAN",
      adultStatus: "UNCERTAIN",
      rapportPriority: true,
      lastMessageAt: new Date(Date.now() - 60_000),
    },
  });
  await prisma.message.create({
    data: {
      organizationId: agency.id,
      conversationId: convUncertain.id,
      authorType: "SUBSCRIBER",
      body: "hi how old do i have to be to talk like this",
      isDemo: true,
    },
  });

  const mayaLast = await prisma.message.findFirst({
    where: { conversationId: maya!.conversationId },
    orderBy: { createdAt: "desc" },
  });
  await prisma.subscriberMemory.create({
    data: {
      organizationId: agency.id,
      subscriberId: maya!.fanId,
      creatorId: maya!.creatorId,
      category: "EXPLICIT_PREFERENCES",
      key: "likes_girlcock",
      value: "Responds strongly to girlcock / lingerie teasing",
      sourceMessageId: mayaLast?.id,
      confidence: 0.86,
      verified: true,
      sensitivity: "SENSITIVE",
    },
  });
  await prisma.conversationSummary.create({
    data: {
      organizationId: agency.id,
      conversationId: maya!.conversationId,
      summary:
        "Alex compliments Maya's stories. Adult, interested, bought the engagement pic, now asking about girlcock.",
      messageCount: 1,
    },
  });

  await prisma.purchase.create({
    data: {
      organizationId: agency.id,
      conversationId: elena!.conversationId,
      subscriberId: elena!.fanId,
      productId: elena!.productIds[0]!,
      amountCents: 3500,
    },
  });

  const template = await prisma.promptTemplate.create({
    data: {
      organizationId: null,
      name: "Canopy copilot v3",
      description: "Auto-send copilot with list-price-first concessions",
      isSystem: true,
    },
  });
  await prisma.promptVersion.create({
    data: {
      templateId: template.id,
      version: 1,
      isActive: true,
      sections: {
        global: "in-character auto replies",
        safety: "deterministic age and consent rules",
        agencyRules: "20-30 words, list price first, concession after a no",
      },
    },
  });

  const manuals = [
    {
      title: "Sexting Script Master Guidelines",
      documentType: "SALES_SCRIPT" as const,
      chunks: AGENCY_TRAINING_CHUNKS.filter((c) => c.title.startsWith("Sexting") || c.title.startsWith("Pet")),
    },
    {
      title: "Trans Model Terminology",
      documentType: "CREATOR_INSTRUCTIONS" as const,
      chunks: AGENCY_TRAINING_CHUNKS.filter((c) => c.tags.includes("trans")),
    },
    {
      title: "Chatter training chapters 1–6",
      documentType: "CHATTER_TRAINING" as const,
      chunks: AGENCY_TRAINING_CHUNKS.filter((c) => c.title.startsWith("Chapter")),
    },
  ];

  for (const manual of manuals) {
    await prisma.trainingDocument.create({
      data: {
        organizationId: agency.id,
        title: manual.title,
        documentType: manual.documentType,
        mimeType: "text/plain",
        status: "APPROVED",
        rawText: manual.chunks.map((c) => c.content).join("\n\n"),
        chunks: {
          create: manual.chunks.map((c) => ({
            organizationId: agency.id,
            content: c.content,
            documentType: c.documentType,
            intent: c.intent,
            funnelStage: c.funnelStage,
            status: "APPROVED",
            qualityScore: 0.95,
            language: "en",
          })),
        },
      },
    });
  }

  await prisma.lLMProviderConfiguration.create({
    data: {
      organizationId: null,
      provider: "venice",
      generationModel: "",
      classificationModel: "",
      isActive: true,
    },
  });

  await prisma.dataRetentionPolicy.create({
    data: { organizationId: agency.id },
  });
  await prisma.dataRetentionPolicy.create({
    data: { organizationId: outsider.id },
  });

  await prisma.escalation.create({
    data: {
      organizationId: agency.id,
      conversationId: convUncertain.id,
      openedById: chatter1.id,
      reason: "MINOR_OR_UNCERTAIN_AGE",
      status: "OPEN",
      summary: "DEMO: age status UNCERTAIN — explicit generation blocked.",
      riskEvent: { flags: ["UNCERTAIN_AGE"], retainedText: false },
    },
  });

  const extraFans = [
    { name: "Noah K. (DEMO)", handle: "noahk_demo", creator: seeded[0]!, stage: "OFFER" as const, spend: 2500, intent: "PURCHASE_INTEREST" as const, outcome: "INSERTED" as const },
    { name: "Priya L. (DEMO)", handle: "priyal_demo", creator: seeded[0]!, stage: "OBJECTION" as const, spend: 0, intent: "PRICE_OBJECTION" as const, outcome: "EDITED" as const },
    { name: "Marcus D. (DEMO)", handle: "marcusd_demo", creator: seeded[1]!, stage: "PURCHASE" as const, spend: 3500, intent: "PURCHASE_INTEREST" as const, outcome: "INSERTED" as const },
    { name: "Owen F. (DEMO)", handle: "owenf_demo", creator: seeded[1]!, stage: "FOLLOW_UP" as const, spend: 3500, intent: "CASUAL_CHAT" as const, outcome: "SELECTED" as const },
    { name: "Theo R. (DEMO)", handle: "theor_demo", creator: seeded[2]!, stage: "RAPPORT" as const, spend: 0, intent: "FLIRT" as const, outcome: "DISCARDED" as const },
    { name: "Blake S. (DEMO)", handle: "blakes_demo", creator: seeded[2]!, stage: "OFFER" as const, spend: 1900, intent: "CONTENT_REQUEST" as const, outcome: "INSERTED" as const },
    { name: "Andre V. (DEMO)", handle: "andrev_demo", creator: seeded[3]!, stage: "INTEREST" as const, spend: 0, intent: "FLIRT" as const, outcome: "EDITED" as const },
    { name: "Chris P. (DEMO)", handle: "chrisp_demo", creator: seeded[3]!, stage: "PURCHASE" as const, spend: 2000, intent: "PURCHASE_INTEREST" as const, outcome: "INSERTED" as const },
  ];

  for (const fan of extraFans) {
    const subscriber = await prisma.subscriber.create({
      data: {
        organizationId: agency.id,
        displayName: fan.name,
        platformHandle: fan.handle,
        adultStatus: "VERIFIED_ADULT",
        isDemo: true,
      },
    });
    const conversation = await prisma.conversation.create({
      data: {
        organizationId: agency.id,
        creatorId: fan.creator.creatorId,
        subscriberId: subscriber.id,
        funnelStage: fan.stage,
        adultStatus: "VERIFIED_ADULT",
        unreadCount: fan.outcome === "DISCARDED" ? 2 : 0,
        lastMessageAt: new Date(Date.now() - extraFans.indexOf(fan) * 3_600_000),
      },
    });
    const opener = await prisma.message.create({
      data: {
        organizationId: agency.id,
        conversationId: conversation.id,
        authorType: "SUBSCRIBER",
        body: fan.stage === "OBJECTION" ? "that's a lot, anything cheaper?" : "you around? i liked that last set",
        isDemo: true,
      },
    });
    const generation = await prisma.generation.create({
      data: {
        organizationId: agency.id,
        conversationId: conversation.id,
        requestedById: chatter1.id,
        provider: "venice",
        model: "demo-seed",
        status: fan.outcome === "DISCARDED" ? "MANUAL_REVIEW" : "COMPLETED",
        intent: fan.intent,
        funnelStage: fan.stage,
        recommendedAction: fan.stage === "OFFER" || fan.stage === "PURCHASE" ? "PRESENT_OFFER" : "REPLY",
        recommendedProductId: fan.creator.productIds[0],
        approvedPriceCents: fan.spend || null,
        requiresHumanReview: true,
        requestId: `seed-${fan.handle}`,
      },
    });
    await prisma.replyOption.create({
      data: {
        organizationId: agency.id,
        generationId: generation.id,
        text: "mmm you caught me. the set is still list price if you actually want it",
        originalText: "mmm you caught me. the set is still list price if you actually want it",
        tone: "PLAYFUL",
        internalReason: "DEMO seed suggestion",
        outcome: fan.outcome,
        selectedById: chatter1.id,
        messageId:
          fan.outcome === "DISCARDED"
            ? null
            : (
                await prisma.message.create({
                  data: {
                    organizationId: agency.id,
                    conversationId: conversation.id,
                    authorType: "CHATTER",
                    authorUserId: chatter1.id,
                    body:
                      fan.outcome === "EDITED"
                        ? "ok baby, list is still $19 — tell me if you want the girlcock one"
                        : "mmm you caught me. the set is still list price if you actually want it",
                    isDemo: true,
                    aiAssisted: true,
                  },
                })
              ).id,
      },
    });
    if (fan.spend) {
      await prisma.offer.create({
        data: {
          organizationId: agency.id,
          conversationId: conversation.id,
          productId: fan.creator.productIds[0]!,
          priceCents: fan.spend,
          accepted: fan.stage === "PURCHASE" || fan.stage === "FOLLOW_UP",
        },
      });
      if (fan.stage === "PURCHASE" || fan.stage === "FOLLOW_UP") {
        await prisma.purchase.create({
          data: {
            organizationId: agency.id,
            conversationId: conversation.id,
            subscriberId: subscriber.id,
            productId: fan.creator.productIds[0]!,
            amountCents: fan.spend,
          },
        });
      }
    }
    void opener;
  }

  const analyticsRows = [];
  for (let day = 0; day < 30; day++) {
    const createdAt = new Date(Date.now() - day * 24 * 60 * 60 * 1000);
    const creatorId = seeded[day % seeded.length]!.creatorId;
    analyticsRows.push(
      {
        organizationId: agency.id,
        type: "MESSAGE_RECEIVED" as const,
        creatorId,
        chatterId: day % 2 ? chatter1.id : chatter2.id,
        numericValue: 4 + (day % 3),
        createdAt,
      },
      {
        organizationId: agency.id,
        type: "SUGGESTIONS_PRODUCED" as const,
        creatorId,
        chatterId: day % 2 ? chatter1.id : chatter2.id,
        numericValue: 1,
        createdAt,
      },
      {
        organizationId: agency.id,
        type: day % 3 === 0 ? ("SUGGESTION_EDITED" as const) : ("SUGGESTION_ACCEPTED" as const),
        creatorId,
        chatterId: day % 2 ? chatter1.id : chatter2.id,
        numericValue: 1,
        createdAt,
      },
      {
        organizationId: agency.id,
        type: "OFFER_PRESENTED" as const,
        creatorId,
        numericValue: 25,
        createdAt,
      },
      {
        organizationId: agency.id,
        type: "PURCHASE" as const,
        creatorId,
        numericValue: 20 + (day % 5) * 5,
        createdAt,
      },
    );
  }
  await prisma.analyticsEvent.createMany({
    data: [
      {
        organizationId: agency.id,
        type: "MESSAGE_RECEIVED",
        creatorId: maya!.creatorId,
        chatterId: chatter1.id,
        conversationId: maya!.conversationId,
        numericValue: 1,
      },
      {
        organizationId: agency.id,
        type: "GENERATION_REQUESTED",
        creatorId: maya!.creatorId,
        chatterId: chatter1.id,
        conversationId: maya!.conversationId,
        numericValue: 1,
      },
      {
        organizationId: agency.id,
        type: "SAFETY_BLOCK",
        creatorId: maya!.creatorId,
        conversationId: convUncertain.id,
        numericValue: 1,
      },
      {
        organizationId: agency.id,
        type: "ESCALATION",
        creatorId: maya!.creatorId,
        conversationId: convUncertain.id,
        chatterId: chatter1.id,
        numericValue: 1,
      },
      ...analyticsRows,
    ],
  });

  console.log("Seeded Canopy demo data.");
  console.log("All demo passwords:", DEMO_PASSWORD);
  console.log("Admin: admin@canopy.dev");
  console.log("Owner: owner@demo.canopy");
  console.log("Manager: manager@demo.canopy");
  console.log("Chatters: chatter1@demo.canopy / chatter2@demo.canopy");
  console.log("Creators: maya@ / elena@ / jade@ / lila@demo.canopy");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
