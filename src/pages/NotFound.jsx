import React from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const NotFound = () => {
  return (
    <div className="container mx-auto px-4 py-8 flex items-center justify-center min-h-screen">
      <Card className="max-w-md mx-auto text-center">
        <CardHeader>
          <CardTitle className="text-6xl font-bold">404</CardTitle>
          <CardDescription className="text-lg">
            Page Not Found
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="mb-6">The page you're looking for doesn't exist.</p>
          <Button asChild>
            <Link to="/">Go Home</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default NotFound;