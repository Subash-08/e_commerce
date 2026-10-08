import type {
  ProductInput,
  VariantInput,
} from "../../src/modules/catalog/validation.ts";
import { productInput } from "../../src/modules/catalog/validation.ts";

export const DEMO_SEED_MARKER = "demo-catalog-v1";
export const DEMO_SEED_ACTOR = "operator:demo-catalog-seed";

export const demoIds = {
  brands: {
    northstar: "670000000000000000000001",
    pixelworks: "670000000000000000000002",
    soundcraft: "670000000000000000000003",
    hometech: "670000000000000000000004",
  },
  categories: {
    computers: "671000000000000000000001",
    laptops: "671000000000000000000002",
    desktops: "671000000000000000000003",
    accessories: "671000000000000000000004",
    monitors: "671000000000000000000005",
    audio: "671000000000000000000006",
    networking: "671000000000000000000007",
    storage: "671000000000000000000008",
  },
  attributes: {
    memory: "672000000000000000000001",
    storage: "672000000000000000000002",
    colour: "672000000000000000000003",
    screenSize: "672000000000000000000004",
  },
  options: {
    memory8: "673000000000000000000001",
    memory16: "673000000000000000000002",
    memory32: "673000000000000000000003",
    storage256: "673000000000000000000004",
    storage512: "673000000000000000000005",
    storage1tb: "673000000000000000000006",
    black: "673000000000000000000007",
    silver: "673000000000000000000008",
    screen24: "673000000000000000000009",
    screen27: "67300000000000000000000a",
    screen32: "67300000000000000000000b",
  },
  products: {
    notebook: "674000000000000000000001",
    gamingLaptop: "674000000000000000000002",
    miniPc: "674000000000000000000003",
    monitor: "674000000000000000000004",
    keyboard: "674000000000000000000005",
    studioLaptop: "674000000000000000000006",
    officeTower: "674000000000000000000007",
    visionMonitor: "674000000000000000000008",
    mouse: "674000000000000000000009",
    earbuds: "67400000000000000000000a",
    headset: "67400000000000000000000b",
    router: "67400000000000000000000c",
    portableSsd: "67400000000000000000000d",
  },
  variants: {
    notebook8: "675000000000000000000001",
    notebook16: "675000000000000000000002",
    gaming16: "675000000000000000000003",
    gaming32: "675000000000000000000004",
    mini256: "675000000000000000000005",
    mini512: "675000000000000000000006",
    monitor24: "675000000000000000000007",
    monitor27: "675000000000000000000008",
    keyboardBlack: "675000000000000000000009",
    keyboardSilver: "67500000000000000000000a",
    studioLaptop: "67500000000000000000000b",
    officeTower: "67500000000000000000000c",
    visionMonitor: "67500000000000000000000d",
    mouse: "67500000000000000000000e",
    earbuds: "67500000000000000000000f",
    headset: "675000000000000000000010",
    router: "675000000000000000000011",
    portableSsd: "675000000000000000000012",
  },
} as const;

export const demoBrands = [
  {
    id: demoIds.brands.northstar,
    name: "Demo Northstar",
    slug: "demo-northstar",
    description:
      "Portable computers and compact workstations for the demo catalog.",
    featured: true,
    displayOrder: 10,
  },
  {
    id: demoIds.brands.pixelworks,
    name: "Demo Pixelworks",
    slug: "demo-pixelworks",
    description:
      "Displays and desk accessories used to exercise catalog presentation.",
    featured: true,
    displayOrder: 20,
  },
  {
    id: demoIds.brands.soundcraft,
    name: "Demo Soundcraft",
    slug: "demo-soundcraft",
    description:
      "Personal audio products for testing category and price filters.",
    featured: true,
    displayOrder: 30,
  },
  {
    id: demoIds.brands.hometech,
    name: "Demo HomeTech",
    slug: "demo-hometech",
    description: "Networking and storage products for home and small offices.",
    featured: true,
    displayOrder: 40,
  },
] as const;

export const demoCategories = [
  {
    id: demoIds.categories.computers,
    name: "Demo Computers",
    slug: "demo-computers",
    parentId: null,
    description: "Demo laptops and desktop computers.",
    featured: true,
    displayOrder: 10,
  },
  {
    id: demoIds.categories.laptops,
    name: "Demo Laptops",
    slug: "demo-laptops",
    parentId: demoIds.categories.computers,
    description: "Portable computers for work, study and gaming.",
    featured: true,
    displayOrder: 11,
  },
  {
    id: demoIds.categories.desktops,
    name: "Demo Desktops",
    slug: "demo-desktops",
    parentId: demoIds.categories.computers,
    description: "Compact desktop systems for everyday work.",
    featured: false,
    displayOrder: 12,
  },
  {
    id: demoIds.categories.accessories,
    name: "Demo Accessories",
    slug: "demo-accessories",
    parentId: null,
    description: "Keyboards, displays and desk accessories.",
    featured: true,
    displayOrder: 20,
  },
  {
    id: demoIds.categories.monitors,
    name: "Demo Monitors",
    slug: "demo-monitors",
    parentId: demoIds.categories.accessories,
    description: "Productivity and entertainment displays.",
    featured: false,
    displayOrder: 21,
  },
  {
    id: demoIds.categories.audio,
    name: "Demo Audio",
    slug: "demo-audio",
    parentId: demoIds.categories.accessories,
    description: "Headphones, earbuds and personal listening products.",
    featured: true,
    displayOrder: 22,
  },
  {
    id: demoIds.categories.networking,
    name: "Demo Networking",
    slug: "demo-networking",
    parentId: null,
    description: "Routers and connected-home equipment.",
    featured: true,
    displayOrder: 30,
  },
  {
    id: demoIds.categories.storage,
    name: "Demo Storage",
    slug: "demo-storage",
    parentId: demoIds.categories.accessories,
    description: "Portable and desktop storage products.",
    featured: true,
    displayOrder: 23,
  },
] as const;

export const demoAttributes = [
  {
    id: demoIds.attributes.memory,
    code: "demo_memory",
    name: "Memory",
    type: "SINGLE_SELECT" as const,
    unit: "GB",
    visible: true,
    filterable: true,
    variantAxisAllowed: true,
    displayOrder: 10,
    options: [
      {
        id: demoIds.options.memory8,
        label: "8 GB",
        colour: "",
        active: true,
      },
      {
        id: demoIds.options.memory16,
        label: "16 GB",
        colour: "",
        active: true,
      },
      {
        id: demoIds.options.memory32,
        label: "32 GB",
        colour: "",
        active: true,
      },
    ],
  },
  {
    id: demoIds.attributes.storage,
    code: "demo_storage",
    name: "Storage",
    type: "SINGLE_SELECT" as const,
    unit: "",
    visible: true,
    filterable: true,
    variantAxisAllowed: true,
    displayOrder: 20,
    options: [
      {
        id: demoIds.options.storage256,
        label: "256 GB SSD",
        colour: "",
        active: true,
      },
      {
        id: demoIds.options.storage512,
        label: "512 GB SSD",
        colour: "",
        active: true,
      },
      {
        id: demoIds.options.storage1tb,
        label: "1 TB SSD",
        colour: "",
        active: true,
      },
    ],
  },
  {
    id: demoIds.attributes.colour,
    code: "demo_colour",
    name: "Colour",
    type: "COLOUR" as const,
    unit: "",
    visible: true,
    filterable: true,
    variantAxisAllowed: true,
    displayOrder: 30,
    options: [
      {
        id: demoIds.options.black,
        label: "Midnight black",
        colour: "#18181b",
        active: true,
      },
      {
        id: demoIds.options.silver,
        label: "Silver",
        colour: "#d4d4d8",
        active: true,
      },
    ],
  },
  {
    id: demoIds.attributes.screenSize,
    code: "demo_screen_size",
    name: "Screen size",
    type: "SINGLE_SELECT" as const,
    unit: "in",
    visible: true,
    filterable: true,
    variantAxisAllowed: true,
    displayOrder: 40,
    options: [
      {
        id: demoIds.options.screen24,
        label: "24 inch",
        colour: "",
        active: true,
      },
      {
        id: demoIds.options.screen27,
        label: "27 inch",
        colour: "",
        active: true,
      },
      {
        id: demoIds.options.screen32,
        label: "32 inch",
        colour: "",
        active: true,
      },
    ],
  },
] as const;

const image = (url: string, alt: string) => ({ url, alt });
const laptopImage = image(
  "https://images.unsplash.com/photo-1496181133206-80ce9b88a853?auto=format&fit=crop&w=1200&q=80",
  "Open laptop on a desk",
);
const gamingImage = image(
  "https://images.unsplash.com/photo-1603302576837-37561b2e2302?auto=format&fit=crop&w=1200&q=80",
  "Gaming laptop with illuminated keyboard",
);
const desktopImage = image(
  "https://images.unsplash.com/photo-1593640495253-23196b27a87f?auto=format&fit=crop&w=1200&q=80",
  "Compact desktop workspace",
);
const monitorImage = image(
  "https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?auto=format&fit=crop&w=1200&q=80",
  "Desktop monitor on a workspace",
);
const keyboardImage = image(
  "https://images.unsplash.com/photo-1587829741301-dc798b83add3?auto=format&fit=crop&w=1200&q=80",
  "Mechanical keyboard",
);
const audioImage = image(
  "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=1200&q=80",
  "Over-ear headphones",
);
const earbudsImage = image(
  "https://images.unsplash.com/photo-1590658268037-6bf12165a8df?auto=format&fit=crop&w=1200&q=80",
  "Wireless earbuds",
);
const routerImage = image(
  "https://images.unsplash.com/photo-1606904825846-647eb07f5be2?auto=format&fit=crop&w=1200&q=80",
  "Wireless network router",
);
const storageImage = image(
  "https://images.unsplash.com/photo-1531492746076-161ca9bcad58?auto=format&fit=crop&w=1200&q=80",
  "Portable storage drive",
);
const mouseImage = image(
  "https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?auto=format&fit=crop&w=1200&q=80",
  "Computer mouse",
);

function variant(
  id: string,
  sku: string,
  title: string,
  mrpPaise: number,
  salePaise: number,
  options: VariantInput["options"],
  onHand: number | null,
): VariantInput {
  return {
    id,
    sku,
    barcode: "",
    title,
    options,
    active: true,
    archived: false,
    mrpPaise,
    salePaise,
    costPaise: null,
    priceMode: "INCLUSIVE",
    gstRateBps: 1800,
    trackQuantity: onHand !== null,
    stockStatus: onHand === null || onHand > 0 ? "IN_STOCK" : "OUT_OF_STOCK",
    onHand,
    media: [],
    weightGrams: null,
    lengthMm: null,
    widthMm: null,
    heightMm: null,
    specifications: [],
  };
}

type ProductFields = Omit<
  ProductInput,
  "revision" | "status" | "seo" | "notes" | "manufacturerContent" | "videos"
> &
  Partial<Pick<ProductInput, "seo" | "manufacturerContent" | "videos">>;

function product(value: ProductFields): ProductInput {
  return productInput.parse({
    ...value,
    status: "ACTIVE",
    notes: "Seeded demo record. Rerunning the seed resets demo fields.",
    manufacturerContent: value.manufacturerContent ?? [],
    videos: value.videos ?? [],
    seo: value.seo ?? {
      title: "",
      description: value.summary.slice(0, 170),
      robotsIndex: false,
    },
  });
}

type SimpleProductFields = {
  name: string;
  slug: string;
  brandId: string;
  categoryIds: string[];
  primaryCategoryId: string;
  summary: string;
  description: string;
  modelNumber: string;
  hsn: string;
  tags: string[];
  warranty: string;
  thumbnail: ReturnType<typeof image>;
  variantId: string;
  sku: string;
  variantTitle: string;
  mrpPaise: number;
  salePaise: number;
  options: VariantInput["options"];
  onHand: number | null;
};

function simpleProduct(value: SimpleProductFields): ProductInput {
  return product({
    name: value.name,
    slug: value.slug,
    brandId: value.brandId,
    categoryIds: value.categoryIds,
    primaryCategoryId: value.primaryCategoryId,
    summary: value.summary,
    description: value.description,
    modelNumber: value.modelNumber,
    hsn: value.hsn,
    tags: value.tags,
    warranty: value.warranty,
    thumbnail: value.thumbnail,
    hoverImage: null,
    media: [value.thumbnail],
    attributes: [],
    specifications: [
      {
        heading: "Overview",
        entries: [{ label: "Model", value: value.modelNumber }],
      },
    ],
    features: [
      {
        title: "Demo catalog coverage",
        description:
          "Seeded to exercise storefront navigation, filters and pagination.",
      },
    ],
    linkedProductIds: [],
    defaultVariantId: value.variantId,
    variants: [
      variant(
        value.variantId,
        value.sku,
        value.variantTitle,
        value.mrpPaise,
        value.salePaise,
        value.options,
        value.onHand,
      ),
    ],
  });
}
export const demoProducts: ReadonlyArray<{
  id: string;
  input: ProductInput;
}> = [
  {
    id: demoIds.products.notebook,
    input: product({
      name: "Demo Northstar Air 14",
      slug: "demo-northstar-air-14",
      brandId: demoIds.brands.northstar,
      categoryIds: [demoIds.categories.computers, demoIds.categories.laptops],
      primaryCategoryId: demoIds.categories.laptops,
      summary:
        "A lightweight 14-inch notebook with configurable memory and storage.",
      description:
        "A balanced demonstration notebook for testing variant selection, pricing, stock and responsive product media.",
      modelNumber: "DEMO-NSA14",
      hsn: "84713010",
      tags: ["demo", "laptop", "portable"],
      warranty: "1 year demonstration warranty",
      thumbnail: laptopImage,
      hoverImage: gamingImage,
      media: [laptopImage],
      attributes: [],
      specifications: [
        {
          heading: "Display",
          entries: [
            { label: "Panel", value: "14-inch IPS" },
            { label: "Resolution", value: "1920 × 1200" },
          ],
        },
      ],
      features: [
        {
          title: "Portable",
          description: "Lightweight format for mobile work.",
        },
        {
          title: "Upgradeable",
          description: "Multiple memory and storage configurations.",
        },
      ],
      linkedProductIds: [demoIds.products.monitor, demoIds.products.keyboard],
      defaultVariantId: demoIds.variants.notebook8,
      variants: [
        variant(
          demoIds.variants.notebook8,
          "DEMO-NSA14-8-256",
          "8 GB / 256 GB",
          6_499_900,
          5_799_900,
          [
            {
              attributeId: demoIds.attributes.memory,
              optionId: demoIds.options.memory8,
            },
            {
              attributeId: demoIds.attributes.storage,
              optionId: demoIds.options.storage256,
            },
          ],
          8,
        ),
        variant(
          demoIds.variants.notebook16,
          "DEMO-NSA14-16-512",
          "16 GB / 512 GB",
          7_499_900,
          6_799_900,
          [
            {
              attributeId: demoIds.attributes.memory,
              optionId: demoIds.options.memory16,
            },
            {
              attributeId: demoIds.attributes.storage,
              optionId: demoIds.options.storage512,
            },
          ],
          4,
        ),
      ],
    }),
  },
  {
    id: demoIds.products.gamingLaptop,
    input: product({
      name: "Demo Northstar Forge 16",
      slug: "demo-northstar-forge-16",
      brandId: demoIds.brands.northstar,
      categoryIds: [demoIds.categories.computers, demoIds.categories.laptops],
      primaryCategoryId: demoIds.categories.laptops,
      summary:
        "A gaming notebook with high-refresh display and two memory options.",
      description:
        "A demonstration gaming system used to inspect high-value pricing, variant availability and product-page media.",
      modelNumber: "DEMO-NSF16",
      hsn: "84713010",
      tags: ["demo", "gaming", "laptop"],
      warranty: "1 year demonstration warranty",
      thumbnail: gamingImage,
      hoverImage: null,
      media: [gamingImage],
      attributes: [],
      specifications: [
        {
          heading: "Graphics",
          entries: [{ label: "GPU", value: "Demo discrete graphics" }],
        },
      ],
      features: [
        {
          title: "High refresh display",
          description: "Designed to demonstrate gaming-product merchandising.",
        },
      ],
      linkedProductIds: [demoIds.products.monitor, demoIds.products.keyboard],
      defaultVariantId: demoIds.variants.gaming16,
      variants: [
        variant(
          demoIds.variants.gaming16,
          "DEMO-NSF16-16",
          "16 GB / 512 GB",
          12_499_900,
          11_499_900,
          [
            {
              attributeId: demoIds.attributes.memory,
              optionId: demoIds.options.memory16,
            },
            {
              attributeId: demoIds.attributes.storage,
              optionId: demoIds.options.storage512,
            },
          ],
          3,
        ),
        variant(
          demoIds.variants.gaming32,
          "DEMO-NSF16-32",
          "32 GB / 1 TB",
          14_999_900,
          13_799_900,
          [
            {
              attributeId: demoIds.attributes.memory,
              optionId: demoIds.options.memory32,
            },
            {
              attributeId: demoIds.attributes.storage,
              optionId: demoIds.options.storage1tb,
            },
          ],
          0,
        ),
      ],
    }),
  },
  {
    id: demoIds.products.miniPc,
    input: product({
      name: "Demo Northstar Core Mini",
      slug: "demo-northstar-core-mini",
      brandId: demoIds.brands.northstar,
      categoryIds: [demoIds.categories.computers, demoIds.categories.desktops],
      primaryCategoryId: demoIds.categories.desktops,
      summary: "A compact desktop offered with two SSD capacities.",
      description:
        "A small demonstration desktop for validating category browsing, variant filters and related accessories.",
      modelNumber: "DEMO-NSCM",
      hsn: "84715000",
      tags: ["demo", "desktop", "compact"],
      warranty: "1 year demonstration warranty",
      thumbnail: desktopImage,
      hoverImage: null,
      media: [desktopImage],
      attributes: [],
      specifications: [
        {
          heading: "Connectivity",
          entries: [{ label: "Network", value: "Wi-Fi and Ethernet" }],
        },
      ],
      features: [
        {
          title: "Compact footprint",
          description: "Fits small offices and home desks.",
        },
      ],
      linkedProductIds: [demoIds.products.monitor, demoIds.products.keyboard],
      defaultVariantId: demoIds.variants.mini256,
      variants: [
        variant(
          demoIds.variants.mini256,
          "DEMO-NSCM-256",
          "256 GB SSD",
          4_299_900,
          3_899_900,
          [
            {
              attributeId: demoIds.attributes.storage,
              optionId: demoIds.options.storage256,
            },
          ],
          6,
        ),
        variant(
          demoIds.variants.mini512,
          "DEMO-NSCM-512",
          "512 GB SSD",
          4_799_900,
          4_399_900,
          [
            {
              attributeId: demoIds.attributes.storage,
              optionId: demoIds.options.storage512,
            },
          ],
          5,
        ),
      ],
    }),
  },
  {
    id: demoIds.products.monitor,
    input: product({
      name: "Demo Pixelworks ViewMax",
      slug: "demo-pixelworks-viewmax",
      brandId: demoIds.brands.pixelworks,
      categoryIds: [
        demoIds.categories.accessories,
        demoIds.categories.monitors,
      ],
      primaryCategoryId: demoIds.categories.monitors,
      summary: "A productivity monitor available in 24-inch and 27-inch sizes.",
      description:
        "A demonstration display with size variants for testing catalog filtering and price ranges.",
      modelNumber: "DEMO-PWVM",
      hsn: "85285200",
      tags: ["demo", "monitor", "display"],
      warranty: "3 year demonstration warranty",
      thumbnail: monitorImage,
      hoverImage: null,
      media: [monitorImage],
      attributes: [],
      specifications: [
        {
          heading: "Panel",
          entries: [
            { label: "Technology", value: "IPS" },
            { label: "Refresh rate", value: "100 Hz" },
          ],
        },
      ],
      features: [
        {
          title: "Flexible sizing",
          description: "Choose the size that fits the workspace.",
        },
      ],
      linkedProductIds: [demoIds.products.miniPc],
      defaultVariantId: demoIds.variants.monitor24,
      variants: [
        variant(
          demoIds.variants.monitor24,
          "DEMO-PWVM-24",
          "24 inch",
          1_499_900,
          1_299_900,
          [
            {
              attributeId: demoIds.attributes.screenSize,
              optionId: demoIds.options.screen24,
            },
          ],
          null,
        ),
        variant(
          demoIds.variants.monitor27,
          "DEMO-PWVM-27",
          "27 inch",
          1_999_900,
          1_749_900,
          [
            {
              attributeId: demoIds.attributes.screenSize,
              optionId: demoIds.options.screen27,
            },
          ],
          null,
        ),
      ],
    }),
  },
  {
    id: demoIds.products.keyboard,
    input: product({
      name: "Demo Pixelworks SwiftKey",
      slug: "demo-pixelworks-swiftkey",
      brandId: demoIds.brands.pixelworks,
      categoryIds: [demoIds.categories.accessories],
      primaryCategoryId: demoIds.categories.accessories,
      summary: "A compact mechanical keyboard in two colours.",
      description:
        "A demonstration accessory for validating colour swatches, status-only availability and related-product cards.",
      modelNumber: "DEMO-PWSK",
      hsn: "84716040",
      tags: ["demo", "keyboard", "mechanical"],
      warranty: "1 year demonstration warranty",
      thumbnail: keyboardImage,
      hoverImage: null,
      media: [keyboardImage],
      attributes: [],
      specifications: [
        {
          heading: "Keyboard",
          entries: [
            { label: "Layout", value: "Compact" },
            { label: "Connection", value: "USB" },
          ],
        },
      ],
      features: [
        {
          title: "Two finishes",
          description: "Colour variants exercise storefront swatches.",
        },
      ],
      linkedProductIds: [demoIds.products.notebook, demoIds.products.miniPc],
      defaultVariantId: demoIds.variants.keyboardBlack,
      variants: [
        variant(
          demoIds.variants.keyboardBlack,
          "DEMO-PWSK-BLK",
          "Midnight black",
          699_900,
          599_900,
          [
            {
              attributeId: demoIds.attributes.colour,
              optionId: demoIds.options.black,
            },
          ],
          null,
        ),
        variant(
          demoIds.variants.keyboardSilver,
          "DEMO-PWSK-SLV",
          "Silver",
          699_900,
          599_900,
          [
            {
              attributeId: demoIds.attributes.colour,
              optionId: demoIds.options.silver,
            },
          ],
          null,
        ),
      ],
    }),
  },
  {
    id: demoIds.products.studioLaptop,
    input: simpleProduct({
      name: "Demo Northstar Studio 15",
      slug: "demo-northstar-studio-15",
      brandId: demoIds.brands.northstar,
      categoryIds: [demoIds.categories.computers, demoIds.categories.laptops],
      primaryCategoryId: demoIds.categories.laptops,
      summary: "A larger productivity laptop with 16 GB memory.",
      description:
        "A practical notebook fixture for listing and brand-category cross-filter checks.",
      modelNumber: "DEMO-NSS15",
      hsn: "84713010",
      tags: ["demo", "laptop", "productivity"],
      warranty: "1 year demonstration warranty",
      thumbnail: laptopImage,
      variantId: demoIds.variants.studioLaptop,
      sku: "DEMO-NSS15-16",
      variantTitle: "16 GB / 512 GB",
      mrpPaise: 8_299_900,
      salePaise: 7_499_900,
      options: [
        {
          attributeId: demoIds.attributes.memory,
          optionId: demoIds.options.memory16,
        },
        {
          attributeId: demoIds.attributes.storage,
          optionId: demoIds.options.storage512,
        },
      ],
      onHand: 7,
    }),
  },
  {
    id: demoIds.products.officeTower,
    input: simpleProduct({
      name: "Demo Northstar Office Tower",
      slug: "demo-northstar-office-tower",
      brandId: demoIds.brands.northstar,
      categoryIds: [demoIds.categories.computers, demoIds.categories.desktops],
      primaryCategoryId: demoIds.categories.desktops,
      summary: "A dependable desktop tower for office workloads.",
      description:
        "A desktop fixture that broadens category and storage facet coverage.",
      modelNumber: "DEMO-NSOT",
      hsn: "84715000",
      tags: ["demo", "desktop", "office"],
      warranty: "2 year demonstration warranty",
      thumbnail: desktopImage,
      variantId: demoIds.variants.officeTower,
      sku: "DEMO-NSOT-16-1T",
      variantTitle: "16 GB / 1 TB SSD",
      mrpPaise: 7_899_900,
      salePaise: 6_999_900,
      options: [
        {
          attributeId: demoIds.attributes.memory,
          optionId: demoIds.options.memory16,
        },
        {
          attributeId: demoIds.attributes.storage,
          optionId: demoIds.options.storage1tb,
        },
      ],
      onHand: 4,
    }),
  },
  {
    id: demoIds.products.visionMonitor,
    input: simpleProduct({
      name: "Demo Pixelworks Vision 32",
      slug: "demo-pixelworks-vision-32",
      brandId: demoIds.brands.pixelworks,
      categoryIds: [
        demoIds.categories.accessories,
        demoIds.categories.monitors,
      ],
      primaryCategoryId: demoIds.categories.monitors,
      summary: "A spacious 32-inch display for creative and office work.",
      description:
        "A large-display fixture for screen-size and price-range filters.",
      modelNumber: "DEMO-PWV32",
      hsn: "85285200",
      tags: ["demo", "monitor", "display"],
      warranty: "3 year demonstration warranty",
      thumbnail: monitorImage,
      variantId: demoIds.variants.visionMonitor,
      sku: "DEMO-PWV32",
      variantTitle: "32 inch",
      mrpPaise: 2_899_900,
      salePaise: 2_499_900,
      options: [
        {
          attributeId: demoIds.attributes.screenSize,
          optionId: demoIds.options.screen32,
        },
      ],
      onHand: null,
    }),
  },
  {
    id: demoIds.products.mouse,
    input: simpleProduct({
      name: "Demo Pixelworks QuietMouse",
      slug: "demo-pixelworks-quietmouse",
      brandId: demoIds.brands.pixelworks,
      categoryIds: [demoIds.categories.accessories],
      primaryCategoryId: demoIds.categories.accessories,
      summary: "A quiet wireless mouse in a dark finish.",
      description:
        "An out-of-stock fixture for availability filtering and empty-state checks.",
      modelNumber: "DEMO-PWQM",
      hsn: "84716060",
      tags: ["demo", "mouse", "wireless"],
      warranty: "1 year demonstration warranty",
      thumbnail: mouseImage,
      variantId: demoIds.variants.mouse,
      sku: "DEMO-PWQM-BLK",
      variantTitle: "Midnight black",
      mrpPaise: 249_900,
      salePaise: 199_900,
      options: [
        {
          attributeId: demoIds.attributes.colour,
          optionId: demoIds.options.black,
        },
      ],
      onHand: 0,
    }),
  },
  {
    id: demoIds.products.earbuds,
    input: simpleProduct({
      name: "Demo Soundcraft Wave Buds",
      slug: "demo-soundcraft-wave-buds",
      brandId: demoIds.brands.soundcraft,
      categoryIds: [demoIds.categories.accessories, demoIds.categories.audio],
      primaryCategoryId: demoIds.categories.audio,
      summary: "Compact wireless earbuds for everyday listening.",
      description:
        "A personal-audio fixture for category navigation and lower-price filters.",
      modelNumber: "DEMO-SCWB",
      hsn: "85183000",
      tags: ["demo", "audio", "earbuds", "wireless"],
      warranty: "1 year demonstration warranty",
      thumbnail: earbudsImage,
      variantId: demoIds.variants.earbuds,
      sku: "DEMO-SCWB-BLK",
      variantTitle: "Midnight black",
      mrpPaise: 499_900,
      salePaise: 399_900,
      options: [
        {
          attributeId: demoIds.attributes.colour,
          optionId: demoIds.options.black,
        },
      ],
      onHand: null,
    }),
  },
  {
    id: demoIds.products.headset,
    input: simpleProduct({
      name: "Demo Soundcraft Studio Headset",
      slug: "demo-soundcraft-studio-headset",
      brandId: demoIds.brands.soundcraft,
      categoryIds: [demoIds.categories.accessories, demoIds.categories.audio],
      primaryCategoryId: demoIds.categories.audio,
      summary: "Comfortable over-ear headphones for focused listening.",
      description:
        "A higher-price audio fixture for brand, category and colour filtering.",
      modelNumber: "DEMO-SCSH",
      hsn: "85183000",
      tags: ["demo", "audio", "headphones"],
      warranty: "2 year demonstration warranty",
      thumbnail: audioImage,
      variantId: demoIds.variants.headset,
      sku: "DEMO-SCSH-SLV",
      variantTitle: "Silver",
      mrpPaise: 1_199_900,
      salePaise: 999_900,
      options: [
        {
          attributeId: demoIds.attributes.colour,
          optionId: demoIds.options.silver,
        },
      ],
      onHand: 9,
    }),
  },
  {
    id: demoIds.products.router,
    input: simpleProduct({
      name: "Demo HomeTech Mesh Router",
      slug: "demo-hometech-mesh-router",
      brandId: demoIds.brands.hometech,
      categoryIds: [demoIds.categories.networking],
      primaryCategoryId: demoIds.categories.networking,
      summary: "A compact mesh router for connected homes.",
      description:
        "A networking fixture for top-level category and brand navigation.",
      modelNumber: "DEMO-HTMR",
      hsn: "85176290",
      tags: ["demo", "networking", "router", "mesh"],
      warranty: "2 year demonstration warranty",
      thumbnail: routerImage,
      variantId: demoIds.variants.router,
      sku: "DEMO-HTMR-WHT",
      variantTitle: "Home mesh unit",
      mrpPaise: 899_900,
      salePaise: 749_900,
      options: [],
      onHand: 5,
    }),
  },
  {
    id: demoIds.products.portableSsd,
    input: simpleProduct({
      name: "Demo HomeTech Pocket SSD",
      slug: "demo-hometech-pocket-ssd",
      brandId: demoIds.brands.hometech,
      categoryIds: [demoIds.categories.accessories, demoIds.categories.storage],
      primaryCategoryId: demoIds.categories.storage,
      summary: "A portable solid-state drive with 1 TB capacity.",
      description:
        "A storage fixture for accessory, storage and capacity filter checks.",
      modelNumber: "DEMO-HTPS",
      hsn: "85235100",
      tags: ["demo", "storage", "ssd", "portable"],
      warranty: "3 year demonstration warranty",
      thumbnail: storageImage,
      variantId: demoIds.variants.portableSsd,
      sku: "DEMO-HTPS-1T",
      variantTitle: "1 TB SSD",
      mrpPaise: 1_099_900,
      salePaise: 899_900,
      options: [
        {
          attributeId: demoIds.attributes.storage,
          optionId: demoIds.options.storage1tb,
        },
      ],
      onHand: 11,
    }),
  },
];
