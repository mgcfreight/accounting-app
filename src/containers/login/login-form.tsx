import { useNavigate } from "react-router";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { BaseButton, RHFPasswordField, RHFTextField } from "@/components/common";
import { useUser } from "@/components/providers/user-provider";
import { HOME_PATH } from "@/lib/constants";
import { mockCurrentUser } from "@/lib/mock";

interface LoginFormValues {
  email: string;
  password: string;
}

const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// mokal-app's login form, minus sign-up (Accounts users are created by an
// Admin in Settings). There is no API yet, so Login signs in as the mock user
// and goes straight to the dashboard; with the API, call signIn()
// (services/auth.ts) and pass the user it returns to setUser. The
// authenticator-app (2FA) step waits on open question 6.
export default function LoginForm() {
  const navigate = useNavigate();
  const { setUser } = useUser();
  const [loading, setLoading] = useState(false);
  // No `defaultValues`: the fields are registered native inputs, and a
  // declared default would overwrite credentials the browser autofilled.
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({ mode: "onTouched" });

  const onSubmit = () => {
    setLoading(true);
    setUser(mockCurrentUser);
    navigate(HOME_PATH);
  };

  return (
    <form method="post" noValidate onSubmit={handleSubmit(onSubmit)}>
      <RHFTextField<LoginFormValues>
        name="email"
        register={register}
        error={errors.email}
        rules={{
          required: "Enter your email",
          validate: (value) =>
            EMAIL_SHAPE.test(value.trim()) || "Enter a valid email address",
        }}
        label="Email"
        placeholder="yourid@mgcfreight.com"
        autoComplete="username"
        className="mb-4"
      />
      <RHFPasswordField<LoginFormValues>
        name="password"
        register={register}
        error={errors.password}
        rules={{ required: "Password is required" }}
        label="Password"
        placeholder="Enter Password"
        autoComplete="current-password"
        className="mb-4"
      />
      <BaseButton
        type="submit"
        text="Login"
        isLoading={loading}
        className="my-8 w-full"
      />
    </form>
  );
}
