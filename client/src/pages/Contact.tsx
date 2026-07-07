import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { MapPin, Phone, Mail, Clock, Send } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

const contactSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Please enter a valid email address"),
  subject: z.string().min(5, "Subject must be at least 5 characters"),
  message: z.string().min(10, "Message must be at least 10 characters"),
});

type ContactFormData = z.infer<typeof contactSchema>;

export default function Contact() {
  const { toast } = useToast();

  const form = useForm<ContactFormData>({
    resolver: zodResolver(contactSchema),
    defaultValues: {
      name: "",
      email: "",
      subject: "",
      message: "",
    },
  });

  const sendMessageMutation = useMutation({
    mutationFn: async (data: ContactFormData) => {
      await apiRequest("POST", "/api/contact", data);
    },
    onSuccess: () => {
      toast({
        title: "Message sent successfully!",
        description: "We'll get back to you as soon as possible.",
      });
      form.reset();
    },
    onError: (error) => {
      toast({
        title: "Failed to send message",
        description: error.message || "Please try again later.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: ContactFormData) => {
    sendMessageMutation.mutate(data);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      {/* Hero Section */}
      <section className="py-8 md:py-16 bg-primary text-white">
        <div className="container mx-auto px-[10px] sm:px-4">
          <div className="max-w-4xl mx-auto text-center">
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4 md:mb-6">Contact Us</h1>
            <p className="text-base md:text-xl text-gray-200 px-2">
              We'd love to hear from you. Send us a message and we'll respond as soon as possible.
            </p>
          </div>
        </div>
      </section>

      <div className="container mx-auto px-[10px] sm:px-4 py-8 md:py-16">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 md:gap-12 max-w-6xl mx-auto">
          {/* Contact Form */}
          <div className="order-2 lg:order-1">
            <Card>
              <CardHeader className="pb-4 md:pb-6">
                <CardTitle className="flex items-center text-xl md:text-2xl">
                  <Send className="h-5 w-5 md:h-6 md:w-6 mr-2" />
                  Send us a Message
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4 md:px-6 md:pb-6">
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 md:space-y-6">
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm md:text-base">Full Name</FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="Your Name" 
                              className="text-sm md:text-base py-2 md:py-3"
                              {...field} 
                            />
                          </FormControl>
                          <FormMessage className="text-xs md:text-sm" />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm md:text-base">Email Address</FormLabel>
                          <FormControl>
                            <Input 
                              type="email" 
                              placeholder="your@email.com"
                              className="text-sm md:text-base py-2 md:py-3"
                              {...field} 
                            />
                          </FormControl>
                          <FormMessage className="text-xs md:text-sm" />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="subject"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm md:text-base">Subject</FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="How can we help?"
                              className="text-sm md:text-base py-2 md:py-3"
                              {...field} 
                            />
                          </FormControl>
                          <FormMessage className="text-xs md:text-sm" />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="message"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm md:text-base">Message</FormLabel>
                          <FormControl>
                            <Textarea 
                              rows={4}
                              placeholder="Tell us more about your inquiry..."
                              className="text-sm md:text-base resize-none"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage className="text-xs md:text-sm" />
                        </FormItem>
                      )}
                    />

                    <Button 
                      type="submit" 
                      className="w-full bg-primary hover:bg-primary/90 py-2 md:py-3 text-sm md:text-base"
                      disabled={sendMessageMutation.isPending}
                    >
                      {sendMessageMutation.isPending ? "Sending..." : "Send Message"}
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </div>

          {/* Contact Information */}
          <div className="space-y-6 md:space-y-8 order-1 lg:order-2">
            <div>
              <h2 className="text-xl md:text-2xl font-bold text-primary mb-4 md:mb-6">Get in Touch</h2>
              <p className="text-sm md:text-base text-gray-600 mb-6 md:mb-8 leading-relaxed">
                Have questions about our products, need help with an order, or just want to say hello? 
                We're here to help! Reach out to us using any of the methods below.
              </p>
            </div>

            <div className="space-y-4 md:space-y-6">
              <Card>
                <CardContent className="p-4 md:p-6">
                  <div className="flex items-start space-x-3 md:space-x-4">
                    <div className="w-10 h-10 md:w-12 md:h-12 bg-secondary rounded-lg flex items-center justify-center flex-shrink-0">
                      <MapPin className="h-5 w-5 md:h-6 md:w-6 text-white" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-base md:text-lg mb-1 md:mb-2">Address</h3>
                      <p className="text-sm md:text-base text-gray-600 leading-relaxed">
                        123 Fashion Street<br />
                        Style City, SC 12345<br />
                        United States
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4 md:p-6">
                  <div className="flex items-start space-x-3 md:space-x-4">
                    <div className="w-10 h-10 md:w-12 md:h-12 bg-secondary rounded-lg flex items-center justify-center flex-shrink-0">
                      <Phone className="h-5 w-5 md:h-6 md:w-6 text-white" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-base md:text-lg mb-1 md:mb-2">Phone</h3>
                      <p className="text-sm md:text-base text-gray-600 mb-1">(555) 123-4567</p>
                      <p className="text-xs md:text-sm text-gray-500">Call us for immediate assistance</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4 md:p-6">
                  <div className="flex items-start space-x-3 md:space-x-4">
                    <div className="w-10 h-10 md:w-12 md:h-12 bg-secondary rounded-lg flex items-center justify-center flex-shrink-0">
                      <Mail className="h-5 w-5 md:h-6 md:w-6 text-white" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-base md:text-lg mb-1 md:mb-2">Email</h3>
                      <p className="text-sm md:text-base text-gray-600 mb-1">hello@sho-audio.com</p>
                      <p className="text-xs md:text-sm text-gray-500">We'll respond within 24 hours</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4 md:p-6">
                  <div className="flex items-start space-x-3 md:space-x-4">
                    <div className="w-10 h-10 md:w-12 md:h-12 bg-secondary rounded-lg flex items-center justify-center flex-shrink-0">
                      <Clock className="h-5 w-5 md:h-6 md:w-6 text-white" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-base md:text-lg mb-1 md:mb-2">Business Hours</h3>
                      <div className="text-sm md:text-base text-gray-600 space-y-1">
                        <p>Monday - Friday: 9:00 AM - 8:00 PM</p>
                        <p>Saturday - Sunday: 10:00 AM - 6:00 PM</p>
                        <p className="text-xs md:text-sm text-gray-500 mt-2">All times in EST</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* FAQ Section */}
            <Card>
              <CardHeader className="pb-3 md:pb-6">
                <CardTitle className="text-lg md:text-xl">Frequently Asked Questions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 md:space-y-4 px-4 pb-4 md:px-6 md:pb-6">
                <div>
                  <h4 className="font-semibold mb-1 text-sm md:text-base">What's your return policy?</h4>
                  <p className="text-xs md:text-sm text-gray-600 leading-relaxed">
                    We offer a 30-day return policy for all unworn items with tags attached.
                  </p>
                </div>
                <div>
                  <h4 className="font-semibold mb-1 text-sm md:text-base">Do you offer international shipping?</h4>
                  <p className="text-xs md:text-sm text-gray-600 leading-relaxed">
                    Yes, we ship worldwide! Shipping costs and times vary by location.
                  </p>
                </div>
                <div>
                  <h4 className="font-semibold mb-1 text-sm md:text-base">How can I track my order?</h4>
                  <p className="text-xs md:text-sm text-gray-600 leading-relaxed">
                    You'll receive a tracking number via email once your order ships.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}
