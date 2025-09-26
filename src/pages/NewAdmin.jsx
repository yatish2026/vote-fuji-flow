import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const NewAdmin = () => {
  return (
    <div className="container mx-auto px-4 py-8">
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle>Admin Panel</CardTitle>
          <CardDescription>
            Manage elections and voting systems
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <p>Welcome to the admin panel. Here you can manage elections and view results.</p>
            <Button>Create New Election</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default NewAdmin;