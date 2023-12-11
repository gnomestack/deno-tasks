import { equalsIgnoreCase } from "../deps.ts";

export const compareHelpers = {
    eq: function (a: unknown, b: unknown) {
        if (typeof a === 'string' && typeof b === 'string')
            return equalsIgnoreCase(a, b);

        return a === b;
    },

    and: function (a: unknown, b: unknown) {
        if (typeof a === 'string')
            a = equalsIgnoreCase(a, 'true') || a === '1';

        if (typeof b === 'string')
            b = equalsIgnoreCase(b, 'true') || b === '1';

        return a && b;
    },

    or: function (a: unknown, b: unknown) {
        if (typeof a === 'string')
            a = equalsIgnoreCase(a, 'true') || a === '1';

        if (typeof b === 'string')
            b = equalsIgnoreCase(b, 'true') || b === '1';

        return a || b;
    },

    ne: function (a: unknown, b: unknown) {
        if (typeof a === 'string' && typeof b === 'string')
            return !equalsIgnoreCase(a, b);

        return a !== b;
    },

    lt: function(
        left: unknown,
        right: unknown,
        options?: { forceNumber?: boolean }
      ) {
        if (options?.forceNumber) {
          if (typeof left !== 'number') {
            left = Number(left);
          }
          if (typeof right !== 'number') {
            right = Number(right);
          }
        }
        return (left as number) < (right as number);
      },

      lte: function(
        left: unknown,
        right: unknown,
        options?: { forceNumber?: boolean }
      ) {

        if (left === right)
            return true;

        if (options?.forceNumber) {
          if (typeof left !== 'number') {
            left = Number(left);
          }
          if (typeof right !== 'number') {
            right = Number(right);
          }
        }
        return (left as number) < (right as number);
      },

    gt: function(
        left: unknown,
        right: unknown,
        options?: { forceNumber?: boolean }
      ) {
        if (options?.forceNumber) {
          if (typeof left !== 'number') {
            left = Number(left);
          }
          if (typeof right !== 'number') {
            right = Number(right);
          }
        }
        return (left as number) > (right as number);
      },

        gte: function(
            left: unknown,
            right: unknown,
            options?: { forceNumber?: boolean }
        ) {
            if (left === right)
                return true;
    
            if (options?.forceNumber) {
            if (typeof left !== 'number') {
                left = Number(left);
            }
            if (typeof right !== 'number') {
                right = Number(right);
            }
            }
            return (left as number) > (right as number);
        },
    };

