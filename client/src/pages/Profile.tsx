import { useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useTheme } from "@/hooks/useTheme";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";

const LANGUAGES = [
  { value: "en", label: "English" },
  { value: "fr", label: "French" },
  { value: "es", label: "Spanish" },
];

const CURRENCIES = [
  { value: "USD", label: "USD - $" },
  { value: "EUR", label: "EUR - €" },
  { value: "GBP", label: "GBP - £" },
];

type ProfileFormData = {
  firstName: string;
  lastName: string;
  email: string;
  language: string;
  currency: string;
  profileImageUrl?: string;
};

export default function Profile() {
  const { user, isLoading, updateUser } = useAuth();
  const { toast } = useToast();
  const { theme, toggleTheme } = useTheme();

  const {
    register,
    handleSubmit,
    control,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ProfileFormData>({
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      language: "en",
      currency: "USD",
      profileImageUrl: "",
    },
  });

  // Watch profileImageUrl for live preview
  const profileImageUrl = watch("profileImageUrl");

  useEffect(() => {
    if (user) {
      reset({
        firstName: user.firstName || "",
        lastName: user.lastName || "",
        email: user.email || "",
        language: (user as any).language || "en",
        currency: (user as any).currency || "USD",
        profileImageUrl: user.profileImageUrl || "",
      });
    }
  }, [user, reset]);

  async function onSubmit(data: ProfileFormData) {
    if (!user) return;
    try {
      await updateUser?.({
        ...user,
        firstName: data.firstName,
        lastName: data.lastName,
        language: data.language,
        currency: data.currency,
        profileImageUrl: data.profileImageUrl,
      });
      toast({
        title: "Profile updated",
        description: "Your profile has been successfully updated.",
      });
    } catch {
      toast({
        title: "Error",
        description: "Failed to update profile. Please try again.",
        variant: "destructive",
      });
    }
  }

  if (isLoading)
    return <p className="text-center py-20">Loading profile...</p>;
  if (!user)
    return <p className="text-center py-20">Please login to view your profile.</p>;

  return (
    <>
      <Header />
      <main className="max-w-lg mx-auto p-4 sm:p-8 my-8 bg-white rounded shadow-md min-h-screen">
        <h1 className="text-2xl font-semibold mb-6">My Profile</h1>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Profile Image URL with preview */}
          <div>
            <label
              htmlFor="profileImageUrl"
              className="block mb-1 font-medium"
            >
              Profile Image URL
            </label>
            <Input
              id="profileImageUrl"
              type="url"
              placeholder="https://example.com/myphoto.jpg"
              {...register("profileImageUrl", {
                pattern: {
                  // Relaxed URL pattern - no file extension required
                  value: /^https?:\/\/.+$/,
                  message: "Please enter a valid URL",
                },
              })}
              aria-invalid={errors.profileImageUrl ? "true" : "false"}
            />
            {errors.profileImageUrl && (
              <p className="text-red-600 mt-1">
                {errors.profileImageUrl.message}
              </p>
            )}
            {/* Live preview */}
            {profileImageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={profileImageUrl}
                alt="Profile Preview"
                className="mt-3 w-24 h-24 rounded-full object-cover border border-gray-300"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).src =
                    "/default-profile.png";
                }}
              />
            )}
          </div>

          {/* First Name */}
          <div>
            <label htmlFor="firstName" className="block mb-1 font-medium">
              First Name
            </label>
            <Input
              id="firstName"
              {...register("firstName", {
                required: "First name is required",
              })}
              aria-invalid={errors.firstName ? "true" : "false"}
            />
            {errors.firstName && (
              <p className="text-red-600 mt-1">{errors.firstName.message}</p>
            )}
          </div>

          {/* Last Name */}
          <div>
            <label htmlFor="lastName" className="block mb-1 font-medium">
              Last Name
            </label>
            <Input
              id="lastName"
              {...register("lastName", {
                required: "Last name is required",
              })}
              aria-invalid={errors.lastName ? "true" : "false"}
            />
            {errors.lastName && (
              <p className="text-red-600 mt-1">{errors.lastName.message}</p>
            )}
          </div>

          {/* Email (disabled) */}
          <div>
            <label htmlFor="email" className="block mb-1 font-medium">
              Email
            </label>
            <Input
              id="email"
              type="email"
              {...register("email")}
              disabled
              className="bg-gray-100 cursor-not-allowed"
            />
          </div>

          {/* Language */}
          <div>
            <label className="block mb-1 font-medium">Language</label>
            <Controller
              name="language"
              control={control}
              render={({ field }) => (
                <Select onValueChange={field.onChange} value={field.value}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select language" />
                  </SelectTrigger>
                  <SelectContent>
                    {LANGUAGES.map(({ value, label }) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          {/* Currency */}
          <div>
            <label className="block mb-1 font-medium">Currency</label>
            <Controller
              name="currency"
              control={control}
              render={({ field }) => (
                <Select onValueChange={field.onChange} value={field.value}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select currency" />
                  </SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map(({ value, label }) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          {/* Theme toggle */}
          <div>
            <label className="block mb-1 font-medium">Theme</label>
            <Button type="button" className="w-full" onClick={toggleTheme}>
              Switch to {theme === "dark" ? "Light" : "Dark"} Mode
            </Button>
          </div>

          {/* Submit */}
          <Button type="submit" disabled={isSubmitting} className="w-full">
            {isSubmitting ? "Saving..." : "Save Changes"}
          </Button>
        </form>
      </main>
      <Footer />
    </>
  );
}
