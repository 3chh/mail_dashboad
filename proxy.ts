import { withAuth } from "next-auth/middleware";

const authProxy = withAuth({
  pages: {
    signIn: "/sign-in",
  },
});

export const proxy = authProxy;

export default proxy;

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/otp/:path*",
    "/search/:path*",
    "/orders/:path*",
    "/warehouses/:path*",
    "/scan-jobs/:path*",
    "/settings/:path*",
    "/messages/:path*",
  ],
};
