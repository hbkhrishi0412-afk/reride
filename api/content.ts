import type { VercelRequest, VercelResponse } from '@vercel/node';
import connectToDatabase from '../lib/db';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const mongoose = await connectToDatabase();
    const db = mongoose.connection.db;
    
    if (!db) {
      return res.status(500).json({ 
        success: false, 
        error: 'Database connection not available' 
      });
    }
    
    // Route based on content type
    const { type } = req.query;
    
    switch (type) {
      case 'faqs':
        return await handleFAQs(req, res, db);
      case 'support-tickets':
        return await handleSupportTickets(req, res, db);
      default:
        return res.status(400).json({ 
          success: false, 
          error: 'Invalid content type. Use ?type=faqs or ?type=support-tickets' 
        });
    }
  } catch (error) {
    console.error('Content API Error:', error);
    return res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
}

// FAQs Handler
async function handleFAQs(req: VercelRequest, res: VercelResponse, db: any) {
  const collection = db.collection('faqs');

  switch (req.method) {
    case 'GET':
      return await handleGetFAQs(req, res, collection);
    case 'POST':
      return await handleCreateFAQ(req, res, collection);
    case 'PUT':
      return await handleUpdateFAQ(req, res, collection);
    case 'DELETE':
      return await handleDeleteFAQ(req, res, collection);
    default:
      return res.status(405).json({ error: 'Method not allowed' });
  }
}

async function handleGetFAQs(req: VercelRequest, res: VercelResponse, collection: any) {
  try {
    const { category } = req.query;
    
    let query: any = {};
    
    if (category && category !== 'all') {
      query.category = category;
    }

    const faqs = await collection.find(query).toArray();
    
    return res.status(200).json({
      success: true,
      faqs: faqs,
      count: faqs.length
    });
  } catch (error) {
    console.error('Error fetching FAQs:', error);
    return res.status(500).json({ 
      success: false,
      error: 'Failed to fetch FAQs' 
    });
  }
}

async function handleCreateFAQ(req: VercelRequest, res: VercelResponse, collection: any) {
  try {
    const faqData = req.body;
    
    if (!faqData.question || !faqData.answer || !faqData.category) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: question, answer, category'
      });
    }

    const result = await collection.insertOne({
      ...faqData,
      createdAt: new Date().toISOString()
    });

    return res.status(201).json({
      success: true,
      message: 'FAQ created successfully',
      faq: { ...faqData, _id: result.insertedId }
    });
  } catch (error) {
    console.error('Error creating FAQ:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to create FAQ'
    });
  }
}

async function handleUpdateFAQ(req: VercelRequest, res: VercelResponse, collection: any) {
  try {
    const { id } = req.query;
    const updateData = req.body;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'FAQ ID is required'
      });
    }

    const result = await collection.updateOne(
      { _id: id },
      { $set: { ...updateData, updatedAt: new Date().toISOString() } }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({
        success: false,
        error: 'FAQ not found'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'FAQ updated successfully',
      modifiedCount: result.modifiedCount
    });
  } catch (error) {
    console.error('Error updating FAQ:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to update FAQ'
    });
  }
}

async function handleDeleteFAQ(req: VercelRequest, res: VercelResponse, collection: any) {
  try {
    const { id } = req.query;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'FAQ ID is required'
      });
    }

    const result = await collection.deleteOne({ _id: id });

    if (result.deletedCount === 0) {
      return res.status(404).json({
        success: false,
        error: 'FAQ not found'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'FAQ deleted successfully',
      deletedCount: result.deletedCount
    });
  } catch (error) {
    console.error('Error deleting FAQ:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to delete FAQ'
    });
  }
}

// Support Tickets Handler
async function handleSupportTickets(req: VercelRequest, res: VercelResponse, db: any) {
  const collection = db.collection('supportTickets');

  switch (req.method) {
    case 'GET':
      return await handleGetSupportTickets(req, res, collection);
    case 'POST':
      return await handleCreateSupportTicket(req, res, collection);
    case 'PUT':
      return await handleUpdateSupportTicket(req, res, collection);
    case 'DELETE':
      return await handleDeleteSupportTicket(req, res, collection);
    default:
      return res.status(405).json({ error: 'Method not allowed' });
  }
}

async function handleGetSupportTickets(req: VercelRequest, res: VercelResponse, collection: any) {
  try {
    const { userEmail, status } = req.query;
    
    let query: any = {};
    
    if (userEmail) {
      query.userEmail = userEmail;
    }
    
    if (status) {
      query.status = status;
    }

    const tickets = await collection.find(query).sort({ createdAt: -1 }).toArray();
    
    return res.status(200).json({
      success: true,
      tickets: tickets,
      count: tickets.length
    });
  } catch (error) {
    console.error('Error fetching support tickets:', error);
    return res.status(500).json({ 
      success: false,
      error: 'Failed to fetch support tickets' 
    });
  }
}

async function handleCreateSupportTicket(req: VercelRequest, res: VercelResponse, collection: any) {
  try {
    const ticketData = req.body;
    
    if (!ticketData.userEmail || !ticketData.userName || !ticketData.subject || !ticketData.message) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: userEmail, userName, subject, message'
      });
    }

    const result = await collection.insertOne({
      ...ticketData,
      status: 'Open',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      replies: []
    });

    return res.status(201).json({
      success: true,
      message: 'Support ticket created successfully',
      ticket: { ...ticketData, _id: result.insertedId }
    });
  } catch (error) {
    console.error('Error creating support ticket:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to create support ticket'
    });
  }
}

async function handleUpdateSupportTicket(req: VercelRequest, res: VercelResponse, collection: any) {
  try {
    const { id } = req.query;
    const updateData = req.body;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'Support ticket ID is required'
      });
    }

    const result = await collection.updateOne(
      { _id: id },
      { $set: { ...updateData, updatedAt: new Date().toISOString() } }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({
        success: false,
        error: 'Support ticket not found'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Support ticket updated successfully',
      modifiedCount: result.modifiedCount
    });
  } catch (error) {
    console.error('Error updating support ticket:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to update support ticket'
    });
  }
}

async function handleDeleteSupportTicket(req: VercelRequest, res: VercelResponse, collection: any) {
  try {
    const { id } = req.query;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'Support ticket ID is required'
      });
    }

    const result = await collection.deleteOne({ _id: id });

    if (result.deletedCount === 0) {
      return res.status(404).json({
        success: false,
        error: 'Support ticket not found'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Support ticket deleted successfully',
      deletedCount: result.deletedCount
    });
  } catch (error) {
    console.error('Error deleting support ticket:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to delete support ticket'
    });
  }
}
