let participants = []; // In-memory storage (resets on redeploy; use database for persistence)

export default function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method === 'GET') {
    // Get all participants
    res.status(200).json(participants);
  } else if (req.method === 'POST') {
    // Add new participant
    const { id, name, idNumber, category, status, registeredAt } = req.body;
    const newParticipant = {
      id,
      name,
      idNumber,
      category,
      status: status || 'waiting',
      registeredAt: registeredAt || Date.now(),
    };
    participants.push(newParticipant);
    res.status(201).json(newParticipant);
  } else if (req.method === 'PUT') {
    // Update participant status
    const { id, status } = req.body;
    const participant = participants.find(p => p.id === id);
    if (participant) {
      participant.status = status;
      res.status(200).json(participant);
    } else {
      res.status(404).json({ error: 'Participant not found' });
    }
  } else if (req.method === 'DELETE') {
    // Delete participant
    const { id } = req.body;
    participants = participants.filter(p => p.id !== id);
    res.status(200).json({ message: 'Deleted' });
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}
