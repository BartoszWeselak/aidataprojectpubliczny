import {
  addFavouriteCurrencySchema,
  createUserSchema,
  getCurrencyByIdSchema,
  getCurrencyByNameSchema,
  getFavouriteCurrencyByIdSchema,
  loginSchema,
} from "~/schemes/currency-schemes";
import {
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
} from "~/server/api/trpc";
import bcrypt from "bcrypt";

export const currencyRouter = createTRPCRouter({
  getLatestDayCurrenciesSnapshots: protectedProcedure.query(async ({ ctx }) => {
    const snapshot = await ctx.db.currency.findMany({
      include: { snapshots: { orderBy: { snapshotDate: "desc" }, take: 1 } },
    });
    const favourite = await ctx.db.user.findUnique({
      where: { id: ctx.session.user.id },
      select: { favouriteCurrencies: { select: { id: true } } },
    });
    if (!snapshot || !favourite) {
      return null;
    }
    return snapshot.map((s) => {
      return {
        ...s,
        isFavourite: favourite.favouriteCurrencies.some((c) => c.id === s.id),
      };
    });
  }),
  getCurrencyById: publicProcedure
    .input(getCurrencyByIdSchema)
    .query(({ ctx, input }) => {
      const { id } = input;
      return ctx.db.currency.findUnique({
        where: { id: id },
        include: {
          snapshots: { orderBy: { snapshotDate: "desc" }, take: 100 },
        },
      });
    }),
  getCurrencyByName: publicProcedure
    .input(getCurrencyByNameSchema)
    .query(({ ctx, input }) => {
      const { name } = input;
      return ctx.db.currency.findUnique({
        where: { name: name },
        include: {
          snapshots: { orderBy: { snapshotDate: "desc" }, take: 100 },
        },
      });
    }),
  addFavouriteCurrency: protectedProcedure
    .input(addFavouriteCurrencySchema)
    .mutation(({ ctx, input }) => {
      const { id: currencyId, isFavourite } = input;
      const userId = ctx.session.user.id;
      if (isFavourite) {
        return ctx.db.user.update({
          where: { id: userId },
          data: { favouriteCurrencies: { disconnect: { id: currencyId } } },
        });
      }
      return ctx.db.user.update({
        where: { id: userId },
        data: { favouriteCurrencies: { connect: { id: currencyId } } },
      });
    }),
  //get favourite
  getFavouriteCurrencies: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id;
    const user = await ctx.db.user.findUnique({
      where: { id: userId },
      include: {
        favouriteCurrencies: {
          include: { snapshots: true },
        },
      },
    });

    if (!user) {
      throw new Error("User not found");
    }

    const favourite = await ctx.db.user.findUnique({
      where: { id: userId },
      select: { favouriteCurrencies: { select: { id: true } } },
    });

    return user.favouriteCurrencies.map((currency) => {
      return {
        ...currency,
        isFavourite: favourite.favouriteCurrencies.some(
          (c) => c.id === currency.id,
        ),
        snapshots: currency.snapshots.sort(
          (a, b) => b.snapshotDate.getTime() - a.snapshotDate.getTime(),
        ),
      };
    });
  }),
  getAllCurrencies: publicProcedure.query(({ ctx }) => {
    return ctx.db.currency.findMany({
      select: { id: true, name: true, createdAt: true, updatedAt: true },
    });
  }),
  // test
  getAllCurrenciesExcept: publicProcedure
    .input(getCurrencyByIdSchema)
    .query(async ({ ctx, input }) => {
      const { id } = input;

      const excludedCurrency = await ctx.db.currency.findUnique({
        where: { id: id },
      });

      if (!excludedCurrency) {
        throw new Error("Specified currency not found");
      }

      const allCurrenciesExcept = await ctx.db.currency.findMany({
        where: { id: { not: id } },
        select: { id: true, name: true, createdAt: true, updatedAt: true },
      });

      return allCurrenciesExcept;
    }),
  //test2
  createUser: publicProcedure.input(loginSchema).mutation(({ ctx, input }) => {
    const hashedpassword = bcrypt.hashSync(input.password, 10);

    return ctx.db.user.create({
      data: { email: input.email, password: hashedpassword },
    });
  }),
  //test
  getLatestDayCurrenciesSnapshotsNoFavourite: publicProcedure.query(
    async ({ ctx }) => {
      const snapshot = await ctx.db.currency.findMany({
        include: { snapshots: { orderBy: { snapshotDate: "desc" }, take: 1 } },
      });

      if (!snapshot) {
        return null;
      }

      return snapshot.map((s) => {
        return {
          ...s,
          isFavourite: false, // Bez sprawdzania ulubionych
        };
      });
    },
  ),
});
