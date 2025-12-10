import {
  HomeContent,
  type IHomeContent,
  type HomePageKey,
} from "../models/homeContent";

const HOME_KEY: HomePageKey = "home";

export const homeContentRepo = {
  async getHome(populateProducts = true): Promise<IHomeContent | null> {
    let query: any = (HomeContent.findOne as any)({ pageKey: HOME_KEY });

    if (populateProducts) {
      query = query.populate({
        path: "heroSlides.product",
        select: "name_i18n slug image isBestSeller isSignatureLineup category",
      });
    }

    const doc = await query.lean().exec();
    return doc;
  },

  async upsertHome(data: Partial<IHomeContent>): Promise<IHomeContent> {
    const existing = await (HomeContent.findOne as any)({
      pageKey: HOME_KEY,
    }).exec();

    if (!existing) {
      const doc = new HomeContent({
        ...data,
        pageKey: HOME_KEY,
      });
      return doc.save();
    }

    Object.assign(existing, data, { pageKey: HOME_KEY });
    return existing.save();
  },

  async deleteHome() {
    return (HomeContent.findOneAndDelete as any)({ pageKey: HOME_KEY }).exec();
  },
};
